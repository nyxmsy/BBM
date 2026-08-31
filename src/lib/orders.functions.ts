import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getAnonServerClient,
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
  payment: z.enum(["cod", "pickup"]).default("cod"),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => placeOrderSchema.parse(d))
  .handler(async ({ data }) => {
    // Use anon client to call the secure create_cod_order function
    const anonClient = getAnonServerClient();

    // Prepare items as JSONB for the PostgreSQL function
    const itemsJson = data.items.map((it) => ({
      slug: it.slug,
      qty: it.qty,
    }));

    // Call the secure database function
    const { data: result, error } = await anonClient.rpc("create_cod_order", {
      p_customer_name: data.customerName,
      p_customer_phone: data.phone,
      p_customer_alt_phone: data.phone2 || null,
      p_address: data.payment === "pickup" ? null : data.address || null,
      p_area: data.payment === "pickup" ? null : data.area || null,
      p_city: data.city || "Juba",
      p_delivery_notes: data.notes || null,
      p_payment_method: data.payment,
      p_mpesa_txid: data.txid || null,
      p_items: itemsJson,
    });

    if (error) {
      console.error("create_cod_order error:", error);
      throw new Error(error.message || "Failed to create order");
    }

    if (!result || !result.success) {
      throw new Error("Order creation failed");
    }

    return {
      orderNumber: result.order_number as string,
      subtotal: Number(result.subtotal),
      deliveryFee: Number(result.delivery_fee),
      total: Number(result.total),
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
    
    // Call the secure database function that handles authorization and inventory restoration
    const { data: result, error } = await supabase.rpc("update_order_status", {
      p_order_id: data.id,
      p_new_status: data.status,
    });

    if (error) {
      console.error("update_order_status error:", error);
      throw new Error(`Failed to update order: ${error.message}`);
    }

    if (!result || !result.success) {
      throw new Error("Order status update failed");
    }

    return { ok: true, status: data.status, orderNumber: result.order_number };
  });

const adjustInventorySchema = z.object({
  accessToken: z.string().min(1),
  productId: z.string(),
  quantityChange: z.number().int(),
  reason: z.string().optional(),
});

export const adjustInventory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adjustInventorySchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    
    // Call the secure database function
    const { data: result, error } = await supabase.rpc("adjust_inventory", {
      p_product_id: data.productId,
      p_quantity_change: data.quantityChange,
      p_reason: data.reason || "Manual adjustment",
    });

    if (error) {
      console.error("adjust_inventory error:", error);
      throw new Error(`Failed to adjust inventory: ${error.message}`);
    }

    if (!result || !result.success) {
      throw new Error("Inventory adjustment failed");
    }

    return {
      success: true,
      productId: result.product_id,
      productSlug: result.product_slug,
      previousStock: Number(result.previous_stock),
      newStock: Number(result.new_stock),
      quantityChange: Number(result.quantity_change),
    };
  });
