import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getAnonServerClient,
  getUserScopedServerClient,
  tryGetServiceRoleClient,
} from "../../supabase/client.server";
import { DELIVERY_FEE_JUBA } from "@/lib/orders.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderStatus =
  | "new"
  | "processing"
  | "completed"
  | "picked_up"
  | "delivered"
  | "cancelled"
  | "confirmed"
  | "out_for_delivery";

export const ADMIN_ORDER_STATUSES = [
  "processing",
  "picked_up",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export const ADMIN_ORDER_FILTERS = ["all", ...ADMIN_ORDER_STATUSES] as const;
export type AdminOrderFilter = (typeof ADMIN_ORDER_FILTERS)[number];

const SOLD_STATUSES = new Set<string>(["completed", "picked_up", "delivered"]);

export type OrderItem = {
  id: string;
  order_id: string;
  product_slug: string;
  name_en: string;
  name_ar: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type OrderStatusHistoryItem = {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  changed_by?: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  phone2?: string | null;
  address?: string | null;
  area?: string | null;
  city: string;
  notes?: string | null;
  payment_method: string;
  mpesa_txid?: string | null;
  subtotal: number;
  delivery_fee: number;
  delivery_area_id?: string | null;
  total: number;
  status: OrderStatus;
  inventory_deducted?: boolean;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
  pickup_deadline_at?: string | null;
  auto_cancel_reason?: string | null;
  order_items?: OrderItem[];
  status_history?: OrderStatusHistoryItem[];
};

function parseWithDataOrDirect<T extends z.ZodTypeAny>(schema: T, d: unknown): z.infer<T> {
  if (d && typeof d === "object" && "data" in d && (d as { data: unknown }).data !== undefined) {
    return schema.parse((d as { data: unknown }).data);
  }
  return schema.parse(d);
}

const withAuthToken = z.object({ accessToken: z.string().min(1) });

const placeOrderSchema = z.object({
  items: z
    .array(z.object({ slug: z.string().min(1), qty: z.number().int().min(1).max(100) }))
    .min(1)
    .max(50),
  customerName: z.string().min(2).max(120),
  phone: z.string().min(5).max(40),
  phone2: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  area: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  payment: z.enum(["cod", "pickup"]).default("cod"),
  delivery_area_id: z.string().uuid().optional(),
  accessToken: z.string().min(1).optional(),
});

const updateOrderStatusSchema = z.object({
  accessToken: z.string().min(1),
  id: z.string(),
  status: z.enum(ADMIN_ORDER_STATUSES),
});

function generateOrderNumber() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ORD-${code}`;
}

function writeClient(): SupabaseClient {
  return tryGetServiceRoleClient() ?? getAnonServerClient();
}

type ProductSnap = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  price: number;
  stock: number;
  is_active: boolean;
};

async function loadProductsBySlug(client: SupabaseClient, slugs: string[]): Promise<ProductSnap[]> {
  const { data, error } = await client
    .from("products")
    .select("id, slug, name_en, name_ar, price, stock, is_active")
    .in("slug", slugs);

  if (!error && data && data.length > 0) {
    return (data as Record<string, unknown>[]).map((p) => ({
      id: String(p.id),
      slug: String(p.slug),
      name_en: String(p.name_en ?? "Product"),
      name_ar: String(p.name_ar ?? ""),
      price: Number(p.price ?? 0),
      stock: Number(p.stock ?? 0),
      is_active: Boolean(p.is_active ?? true),
    }));
  }

  const { defaultProductRows } = await import("@/lib/catalog.server");
  return defaultProductRows
    .filter((p) => slugs.includes(p.slug))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name_en: p.name_en,
      name_ar: p.name_ar,
      price: Number(p.price),
      stock: p.stock,
      is_active: true,
    }));
}

async function insertFirstOk<T>(
  client: SupabaseClient,
  table: string,
  payloads: Record<string, unknown>[],
): Promise<T> {
  let lastMessage = "Insert failed";
  for (const payload of payloads) {
    const { data, error } = await client.from(table).insert(payload).select("*").single();
    if (!error && data) return data as T;
    lastMessage = error?.message || lastMessage;
  }
  throw new Error(lastMessage);
}

function mapOrderItem(it: Record<string, unknown>, orderId: string): OrderItem {
  const nested = it.products as Record<string, unknown> | undefined;
  return {
    id: String(it.id ?? ""),
    order_id: String(it.order_id ?? orderId),
    product_slug: String(it.product_slug || nested?.slug || ""),
    name_en: String(it.name_en || nested?.name_en || "Product"),
    name_ar: String(it.name_ar || nested?.name_ar || ""),
    qty: Number(it.qty ?? it.quantity ?? 0),
    unit_price: Number(it.unit_price ?? 0),
    line_total: Number(it.line_total ?? it.total_price ?? 0),
  };
}

function mapOrder(o: Record<string, unknown>): Order {
  const itemsRaw = (o.order_items as Record<string, unknown>[] | undefined) ?? [];
  const historyRaw = (o.order_status_history as Record<string, unknown>[] | undefined) ?? [];
  return {
    id: String(o.id),
    order_number: String(o.order_number),
    customer_name: String(o.customer_name ?? ""),
    phone: String(o.customer_phone || o.phone || ""),
    phone2: (o.customer_alt_phone as string | null) ?? (o.phone2 as string | null) ?? null,
    address: (o.address as string | null) ?? null,
    area: (o.area as string | null) ?? null,
    city: String(o.city || "Juba"),
    notes: (o.delivery_notes as string | null) ?? (o.notes as string | null) ?? null,
    payment_method: String(o.payment_method || "cod"),
    mpesa_txid: (o.mpesa_txid as string | null) ?? null,
    subtotal: Number(o.subtotal || 0),
    delivery_fee: Number(o.delivery_fee || 0),
    delivery_area_id: (o.delivery_area_id as string | null) ?? null,
    total: Number(o.total || 0),
    status: o.status as OrderStatus,
    inventory_deducted: Boolean(o.inventory_deducted),
    user_id: (o.user_id as string | null) ?? null,
    created_at: String(o.created_at ?? ""),
    updated_at: String(o.updated_at ?? o.created_at ?? ""),
    pickup_deadline_at: (o.pickup_deadline_at as string | null) ?? null,
    auto_cancel_reason: (o.auto_cancel_reason as string | null) ?? null,
    order_items: itemsRaw.map((it) => mapOrderItem(it, String(o.id))),
    status_history: historyRaw
      .map((h) => ({
        id: String(h.id ?? ""),
        order_id: String(h.order_id ?? o.id),
        old_status: (h.old_status as string | null) ?? null,
        new_status: String(h.new_status ?? ""),
        reason: (h.reason as string | null) ?? null,
        changed_by: (h.changed_by as string | null) ?? null,
        created_at: String(h.created_at ?? ""),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };
}

async function autoCancelOverduePickups(client: SupabaseClient): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { data: overdue, error } = await client
      .from("orders")
      .select("*")
      .eq("payment_method", "pickup")
      .in("status", ["processing", "new", "confirmed"])
      .not("pickup_deadline_at", "is", null)
      .lt("pickup_deadline_at", now);

    if (error || !overdue || overdue.length === 0) return;

    for (const ord of overdue as Record<string, unknown>[]) {
      const orderId = String(ord.id);
      const orderNumber = String(ord.order_number);
      const deducted = Boolean(ord.inventory_deducted);
      const reason =
        "Cancelled automatically: customer did not collect the order within the pickup window.";

      if (deducted) {
        await applyStockChange(client, orderId, orderNumber, "cancellation");
      }

      await client
        .from("orders")
        .update({
          status: "cancelled",
          auto_cancel_reason: reason,
          inventory_deducted: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      try {
        await client.from("order_status_history").insert({
          order_id: orderId,
          old_status: String(ord.status),
          new_status: "cancelled",
          reason,
          changed_by: "system:auto_cancel",
        });
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    console.warn("autoCancelOverduePickups error:", e);
  }
}

async function fetchOrders(client: SupabaseClient, filter?: { userId?: string }): Promise<Order[]> {
  await autoCancelOverduePickups(client);

  const selects = [
    "*, order_items(*, products(name_en, name_ar, slug)), order_status_history(*)",
    "*, order_items(*, products(name_en, name_ar, slug))",
    "*, order_items(*)",
  ];
  for (const sel of selects) {
    let q = client.from("orders").select(sel).order("created_at", { ascending: false });
    if (filter?.userId) q = q.eq("user_id", filter.userId);
    const { data, error } = await q;
    if (!error && data) {
      return (data as unknown as Record<string, unknown>[]).map(mapOrder);
    }
  }
  return [];
}

async function userIdFromToken(accessToken?: string): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const scoped = getUserScopedServerClient(accessToken);
    const { data } = await scoped.auth.getUser(accessToken);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function computeDeliveryFee(
  client: SupabaseClient,
  pickup: boolean,
  deliveryAreaId?: string,
): Promise<{ fee: number; areaName: string | null }> {
  if (pickup) return { fee: 0, areaName: null };
  if (deliveryAreaId) {
    const { data, error } = await client
      .from("delivery_areas")
      .select("fee, name_en, name_ar, active")
      .eq("id", deliveryAreaId)
      .maybeSingle();
    if (!error && data && data.active) {
      return {
        fee: Number(data.fee),
        areaName: String(data.name_ar || data.name_en),
      };
    }
  }
  return { fee: DELIVERY_FEE_JUBA, areaName: null };
}

async function computePickupWindowDays(client: SupabaseClient): Promise<number> {
  try {
    const { data, error } = await client
      .from("store_settings")
      .select("pickup_window_days")
      .eq("id", 1)
      .maybeSingle();
    if (!error && data?.pickup_window_days) return Number(data.pickup_window_days);
  } catch {
    /* ignore */
  }
  return 5;
}

async function persistOrderDirect(params: {
  client: SupabaseClient;
  data: z.infer<typeof placeOrderSchema>;
  userId: string | null;
}): Promise<{
  orderNumber: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: Array<{
    name_en: string;
    name_ar: string;
    qty: number;
    unit_price: number;
    line_total: number;
    slug: string;
  }>;
}> {
  const slugs = params.data.items.map((i) => i.slug);
  const products = await loadProductsBySlug(params.client, slugs);
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const lineItems = params.data.items.map((it) => {
    const product = bySlug.get(it.slug);
    if (!product) throw new Error(`Product not found: ${it.slug}`);

    if (!product.is_active) {
      throw new Error(`Product currently unavailable: ${product.name_en}`);
    }
    if (product.stock < it.qty) {
      throw new Error(`Insufficient stock for ${product.name_en}. Remaining: ${product.stock}`);
    }

    const line_total = product.price * it.qty;
    return {
      product,
      qty: it.qty,
      unit_price: product.price,
      line_total,
    };
  });

  const subtotal = lineItems.reduce((s, i) => s + i.line_total, 0);
  const pickup = params.data.payment === "pickup";
  const { fee: deliveryFee, areaName: resolvedAreaName } = await computeDeliveryFee(
    params.client,
    pickup,
    params.data.delivery_area_id,
  );
  const total = subtotal + deliveryFee;
  const orderNumber = generateOrderNumber();
  const windowDays = pickup ? await computePickupWindowDays(params.client) : 0;
  const pickupDeadline = pickup
    ? new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const finalArea = resolvedAreaName || params.data.area || null;

  const shared = {
    order_number: orderNumber,
    customer_name: params.data.customerName,
    city: params.data.city || "Juba",
    payment_method: params.data.payment,
    subtotal,
    delivery_fee: deliveryFee,
    delivery_area_id: pickup ? null : (params.data.delivery_area_id ?? null),
    total,
    status: "processing",
    pickup_deadline_at: pickupDeadline,
    auto_cancel_reason: null,
  };

  const address = pickup ? null : params.data.address || null;
  const area = pickup ? null : finalArea;
  const notes = params.data.notes || null;
  const phone2 = params.data.phone2 || null;

  // Try inserts — use correct column names first (customer_phone/customer_alt_phone/delivery_notes)
  // and only fall back to legacy column names on failure.
  const orderRow = await insertFirstOk<Record<string, unknown>>(params.client, "orders", [
    {
      ...shared,
      customer_phone: params.data.phone,
      customer_alt_phone: phone2,
      address,
      area,
      delivery_notes: notes,
      user_id: params.userId,
      inventory_deducted: false,
    },
    {
      ...shared,
      customer_phone: params.data.phone,
      customer_alt_phone: phone2,
      address,
      area,
      delivery_notes: notes,
    },
    {
      ...shared,
      phone: params.data.phone,
      phone2,
      address,
      area,
      notes,
      user_id: params.userId,
      inventory_deducted: false,
    },
    {
      ...shared,
      phone: params.data.phone,
      phone2,
      address,
      area,
      notes,
    },
  ]);

  const orderId = String(orderRow.id);

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  for (const line of lineItems) {
    const productId = uuidRe.test(line.product.id) ? line.product.id : undefined;
    const productName = line.product.name_en || line.product.name_ar;
    // Use correct DB columns (quantity, total_price) as primary attempt;
    // fall back to legacy qty/line_total names only on failure.
    await insertFirstOk(params.client, "order_items", [
      {
        order_id: orderId,
        ...(productId ? { product_id: productId } : {}),
        product_name: productName,
        product_slug: line.product.slug,
        name_en: line.product.name_en,
        name_ar: line.product.name_ar,
        quantity: line.qty,
        unit_price: line.unit_price,
        total_price: line.line_total,
      },
      {
        order_id: orderId,
        product_name: productName,
        product_slug: line.product.slug,
        name_en: line.product.name_en,
        name_ar: line.product.name_ar,
        quantity: line.qty,
        unit_price: line.unit_price,
        total_price: line.line_total,
      },
      {
        order_id: orderId,
        ...(productId ? { product_id: productId } : {}),
        product_name: productName,
        product_slug: line.product.slug,
        name_en: line.product.name_en,
        name_ar: line.product.name_ar,
        qty: line.qty,
        unit_price: line.unit_price,
        line_total: line.line_total,
      },
    ]);
  }

  if (params.userId) {
    await params.client.from("orders").update({ user_id: params.userId }).eq("id", orderId);
  }

  return {
    orderNumber,
    subtotal,
    deliveryFee,
    total,
    items: lineItems.map((l) => ({
      name_en: l.product.name_en,
      name_ar: l.product.name_ar,
      qty: l.qty,
      unit_price: l.unit_price,
      line_total: l.line_total,
      slug: l.product.slug,
    })),
  };
}

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => parseWithDataOrDirect(placeOrderSchema, d))
  .handler(async ({ data }) => {
    const userId = await userIdFromToken(data.accessToken);
    const client = writeClient();

    try {
      return await persistOrderDirect({ client, data, userId });
    } catch (directError) {
      console.warn("Direct order insert failed, trying RPC:", directError);

      const itemsJson = data.items.map((it) => ({ slug: it.slug, qty: it.qty }));
      const anonClient = getAnonServerClient();
      const rpcArgs = {
        p_customer_name: data.customerName,
        p_customer_phone: data.phone,
        p_customer_alt_phone: data.phone2 || null,
        p_address: data.payment === "pickup" ? null : data.address || null,
        p_area: data.payment === "pickup" ? null : data.area || null,
        p_city: data.city || "Juba",
        p_delivery_notes: data.notes || null,
        p_payment_method: data.payment,
        p_items: itemsJson,
      };

      let { data: result, error } = await anonClient.rpc("create_cod_order", {
        ...rpcArgs,
        p_user_id: userId,
      });
      if (error) {
        const retry = await anonClient.rpc("create_cod_order", rpcArgs);
        result = retry.data;
        error = retry.error;
      }

      if (error || !result || result.success === false) {
        const message =
          error?.message ||
          (directError instanceof Error ? directError.message : "Failed to create order");
        throw new Error(message);
      }

      const orderNumber = String(result.order_number);
      if (userId) {
        const privileged = tryGetServiceRoleClient();
        if (privileged) {
          await privileged
            .from("orders")
            .update({ user_id: userId })
            .eq("order_number", orderNumber);
        }
      }

      return {
        orderNumber,
        subtotal: Number(result.subtotal),
        deliveryFee: Number(result.delivery_fee),
        total: Number(result.total),
        items: [] as Array<{
          name_en: string;
          name_ar: string;
          qty: number;
          unit_price: number;
          line_total: number;
          slug: string;
        }>,
      };
    }
  });

export const listOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => parseWithDataOrDirect(withAuthToken, d))
  .handler(async ({ data }): Promise<Order[]> => {
    try {
      // Server-side authorization: only admin/staff may list ALL orders.
      // Server functions are publicly invokable endpoints, so the UI gate in
      // the admin layout is not sufficient on its own.
      const supabase = getUserScopedServerClient(data.accessToken);
      const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
      if (userError || !userData?.user) return [];

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
      if (!roles.includes("admin") && !roles.includes("staff")) return [];

      const privileged = tryGetServiceRoleClient();
      if (privileged) return await fetchOrders(privileged);
      return await fetchOrders(supabase);
    } catch (e) {
      console.warn("listOrders:", e);
      return [];
    }
  });

export const listMyOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => parseWithDataOrDirect(withAuthToken, d))
  .handler(async ({ data }): Promise<Order[]> => {
    const userId = await userIdFromToken(data.accessToken);
    if (!userId) return [];
    try {
      const privileged = tryGetServiceRoleClient();
      if (privileged) return await fetchOrders(privileged, { userId });
      const supabase = getUserScopedServerClient(data.accessToken);
      return await fetchOrders(supabase, { userId });
    } catch (e) {
      console.warn("listMyOrders:", e);
      return [];
    }
  });

async function alreadyDeducted(client: SupabaseClient, orderId: string): Promise<boolean> {
  const { data: order } = await client
    .from("orders")
    .select("inventory_deducted")
    .eq("id", orderId)
    .maybeSingle();
  if (order && (order as { inventory_deducted?: boolean }).inventory_deducted) return true;

  const { data: moves } = await client
    .from("inventory_movements")
    .select("id")
    .eq("order_id", orderId)
    .eq("movement_type", "sale")
    .limit(1);
  return Boolean(moves?.length);
}

async function loadOrderItemsForStock(
  client: SupabaseClient,
  orderId: string,
): Promise<Array<{ product_id?: string; product_slug: string; qty: number }>> {
  const { data } = await client.from("order_items").select("*").eq("order_id", orderId);
  return ((data as Record<string, unknown>[] | null) ?? []).map((it) => ({
    product_id: it.product_id ? String(it.product_id) : undefined,
    product_slug: String(it.product_slug ?? ""),
    qty: Number(it.qty ?? it.quantity ?? 0),
  }));
}

async function applyStockChange(
  client: SupabaseClient,
  orderId: string,
  orderNumber: string,
  direction: "sale" | "cancellation",
) {
  const items = await loadOrderItemsForStock(client, orderId);
  for (const item of items) {
    if (!item.qty) continue;
    let product: { id: string; stock: number; slug: string } | null = null;
    if (item.product_id && !item.product_id.startsWith("prod_")) {
      const { data } = await client
        .from("products")
        .select("id, stock, slug")
        .eq("id", item.product_id)
        .maybeSingle();
      if (data) product = data as { id: string; stock: number; slug: string };
    }
    if (!product && item.product_slug) {
      const { data } = await client
        .from("products")
        .select("id, stock, slug")
        .eq("slug", item.product_slug)
        .maybeSingle();
      if (data) product = data as { id: string; stock: number; slug: string };
    }
    if (!product) continue;

    const delta = direction === "sale" ? -item.qty : item.qty;
    const newStock = Math.max(0, Number(product.stock) + delta);
    await client.from("products").update({ stock: newStock }).eq("id", product.id);
    await client.from("inventory_movements").insert({
      product_id: product.id,
      order_id: orderId,
      movement_type: direction,
      quantity_change: delta,
      previous_stock: product.stock,
      new_stock: newStock,
      reason: `${direction === "sale" ? "Sold" : "Cancelled"} ${orderNumber}`,
    });
  }
}

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => parseWithDataOrDirect(updateOrderStatusSchema, d))
  .handler(async ({ data }) => {
    const scoped = getUserScopedServerClient(data.accessToken);
    const { data: userData, error: userError } = await scoped.auth.getUser(data.accessToken);
    if (userError || !userData?.user) throw new Error("Not authenticated.");

    const { data: roleRows } = await scoped
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("staff")) {
      throw new Error("Unauthorized");
    }

    const client = tryGetServiceRoleClient() ?? scoped;

    const { data: existing, error: loadError } = await client
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (loadError || !existing) throw new Error("Order not found");

    const current = existing as Record<string, unknown>;
    const currentStatus = String(current.status);
    const orderNumber = String(current.order_number);
    const deducted = await alreadyDeducted(client, data.id);
    const paymentMethod = String(current.payment_method || "cod");

    // Auto restock on cancelling an order that had inventory sold.
    if (data.status === "cancelled" && deducted && currentStatus !== "cancelled") {
      await applyStockChange(client, data.id, orderNumber, "cancellation");
      await client.from("orders").update({ inventory_deducted: false }).eq("id", data.id);
    }

    // Deduct stock first time we mark a terminal "sold" status.
    if (SOLD_STATUSES.has(data.status) && !deducted && !SOLD_STATUSES.has(currentStatus)) {
      await applyStockChange(client, data.id, orderNumber, "sale");
      await client.from("orders").update({ inventory_deducted: true }).eq("id", data.id);
    }

    // When setting a pickup order back to Processing, re-compute the pickup window.
    const updates: Record<string, unknown> = { status: data.status };
    if (paymentMethod === "pickup" && data.status === "processing") {
      const windowDays = await computePickupWindowDays(client);
      updates.pickup_deadline_at = new Date(
        Date.now() + windowDays * 24 * 60 * 60 * 1000,
      ).toISOString();
    }

    const { error: updateError } = await client.from("orders").update(updates).eq("id", data.id);

    if (updateError) {
      const mapped: Record<string, string> = {
        processing: "confirmed",
        completed: "delivered",
        picked_up: "delivered",
      };
      const fallback = mapped[data.status];
      if (fallback) {
        const fbUpdates: Record<string, unknown> = { status: fallback };
        if (paymentMethod === "pickup" && fallback === "confirmed") {
          const windowDays = await computePickupWindowDays(client);
          fbUpdates.pickup_deadline_at = new Date(
            Date.now() + windowDays * 24 * 60 * 60 * 1000,
          ).toISOString();
        }
        const { error: retryError } = await client
          .from("orders")
          .update(fbUpdates)
          .eq("id", data.id);
        if (retryError) throw new Error(`Failed to update order: ${retryError.message}`);
      } else {
        throw new Error(`Failed to update order: ${updateError.message}`);
      }
    }

    // Write status history (best-effort, never fails the request)
    try {
      await client.from("order_status_history").insert({
        order_id: data.id,
        old_status: currentStatus === data.status ? null : currentStatus,
        new_status: data.status,
        reason: `Admin status change (${userData.user.email || userData.user.id})`,
        changed_by: userData.user.id,
      });
    } catch {
      /* ignore */
    }

    return { ok: true, status: data.status, orderNumber };
  });

const adjustInventorySchema = z.object({
  accessToken: z.string().min(1),
  productId: z.string(),
  quantityChange: z.number().int(),
  reason: z.string().optional(),
});

export const adjustInventory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => parseWithDataOrDirect(adjustInventorySchema, d))
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);

    const { data: result, error } = await supabase.rpc("adjust_inventory", {
      p_product_id: data.productId,
      p_quantity_change: data.quantityChange,
      p_reason: data.reason || "Manual adjustment",
    });

    if (!error && result?.success) {
      return {
        success: true,
        productId: result.product_id,
        productSlug: result.product_slug,
        previousStock: Number(result.previous_stock),
        newStock: Number(result.new_stock),
        quantityChange: Number(result.quantity_change),
      };
    }

    const client = tryGetServiceRoleClient() ?? supabase;
    const { data: product, error: prodError } = await client
      .from("products")
      .select("id, slug, stock")
      .eq("id", data.productId)
      .maybeSingle();
    if (prodError || !product) {
      throw new Error(error?.message || "Failed to adjust inventory");
    }
    const previousStock = Number(product.stock);
    const newStock = previousStock + data.quantityChange;
    if (newStock < 0) throw new Error("Stock cannot be negative");
    const { error: stockError } = await client
      .from("products")
      .update({ stock: newStock })
      .eq("id", data.productId);
    if (stockError) throw new Error(stockError.message);
    await client.from("inventory_movements").insert({
      product_id: data.productId,
      movement_type: "adjustment",
      quantity_change: data.quantityChange,
      previous_stock: previousStock,
      new_stock: newStock,
      reason: data.reason || "Manual adjustment",
    });
    return {
      success: true,
      productId: data.productId,
      productSlug: String(product.slug),
      previousStock,
      newStock,
      quantityChange: data.quantityChange,
    };
  });
