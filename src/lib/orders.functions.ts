import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getAnonServerClient,
  getServiceRoleClient,
  getUserScopedServerClient,
} from "../../supabase/client.server";

export type OrderStatus = "new" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled";

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
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

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
  payment: z.enum(["cod", "mpesa", "pickup"]).default("cod"),
  txid: z.string().max(80).optional(),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => placeOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const serviceClient = getServiceRoleClient();

    const slugs = [...new Set(data.items.map((i) => i.slug))];
    const { data: productRows, error: lookupError } = await serviceClient
      .from("products")
      .select("id, slug, name_en, name_ar, price, is_active")
      .in("slug", slugs);

    if (lookupError || !productRows || productRows.length === 0) {
      throw new Error("No valid items in order");
    }

    const orderNumber =
      "BBM-" +
      Date.now().toString(36).toUpperCase().slice(-6) +
      Math.floor(Math.random() * 90 + 10);

    const deliveryFee = data.payment === "pickup" ? 0 : 3000;

    const items = data.items
      .map((it) => {
        const prod = productRows.find((p) => p.slug === it.slug);
        if (!prod) return null;
        return {
          product_id: prod.id,
          product_slug: prod.slug,
          name_en: prod.name_en,
          name_ar: prod.name_ar,
          quantity: it.qty,
          unit_price: Number(prod.price),
          total_price: Number(prod.price) * it.qty,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null);

    if (items.length === 0) {
      throw new Error("No valid items in order");
    }

    const subtotal = items.reduce((sum, it) => sum + it.total_price, 0);
    const total = subtotal + deliveryFee;

    const { data: order, error: orderError } = await serviceClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_name: data.customerName,
        customer_phone: data.phone,
        customer_alt_phone: data.phone2 || null,
        address: data.payment === "pickup" ? null : data.address || null,
        area: data.payment === "pickup" ? null : data.area || null,
        city: data.city || "Juba",
        delivery_notes: data.notes || null,
        payment_method: data.payment,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        status: "new",
      })
      .select("id, order_number, total, subtotal, delivery_fee")
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    const orderItemsRows = items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: it.total_price,
    }));

    const { error: itemsError } = await serviceClient.from("order_items").insert(orderItemsRows);

    if (itemsError) {
      throw new Error(`Failed to save order items: ${itemsError.message}`);
    }

    return {
      orderNumber: order.order_number as string,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.delivery_fee),
      total: Number(order.total),
    };
  });

export const listOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => withAuthToken.parse(d))
  .handler(async ({ data }): Promise<Order[]> => {
    try {
      const supabase = getUserScopedServerClient(data.accessToken);
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name_en, name_ar, slug))")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("listOrders query notice:", error.message);
        return [];
      }

      return ((orders ?? []) as any[]).map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        phone: o.customer_phone || "",
        phone2: o.customer_alt_phone,
        address: o.address,
        area: o.area,
        city: o.city || "Juba",
        notes: o.delivery_notes,
        payment_method: o.payment_method || "cod",
        mpesa_txid: null,
        subtotal: Number(o.subtotal || 0),
        delivery_fee: Number(o.delivery_fee || 0),
        total: Number(o.total || 0),
        status: o.status as OrderStatus,
        created_at: o.created_at,
        updated_at: o.updated_at,
        order_items: (o.order_items ?? []).map((it: any) => ({
          id: it.id,
          order_id: it.order_id,
          product_slug: it.products?.slug || "",
          name_en: it.products?.name_en || "Product",
          name_ar: it.products?.name_ar || "",
          qty: it.quantity,
          unit_price: Number(it.unit_price),
          line_total: Number(it.total_price),
        })),
      }));
    } catch {
      return [];
    }
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accessToken: z.string().min(1),
        id: z.string(),
        status: z.enum(["new", "confirmed", "out_for_delivery", "delivered", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    const { error } = await supabase
      .from("orders")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (error) throw new Error(`Failed to update order: ${error.message}`);
    return { ok: true, status: data.status };
  });
