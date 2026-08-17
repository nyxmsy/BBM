import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type OrderStatus = "new" | "confirmed" | "delivered" | "cancelled";

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

// In-memory orders storage
const ordersStore: Order[] = [];

const placeOrderSchema = z.object({
  items: z
    .array(z.object({ slug: z.string().min(1), qty: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
  customerName: z.string().min(2).max(120),
  phone: z.string().min(5).max(40),
  phone2: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  area: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  payment: z.enum(["cod", "mpesa", "pickup"]),
  txid: z.string().max(80).optional(),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => placeOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { fetchProducts } = await import("@/lib/catalog.server");
    const { DELIVERY_FEE_JUBA } = await import("@/lib/orders.server");

    const allProducts = await fetchProducts();
    const slugs = [...new Set(data.items.map((i) => i.slug))];
    const products = allProducts.filter((p) => slugs.includes(p.slug));

    if (!products.length) throw new Error("No valid items in order");

    const orderId = "ord_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);

    const lines: OrderItem[] = data.items
      .map((i) => {
        const p = products.find((x) => x.slug === i.slug);
        if (!p) return null;
        return {
          id: "item_" + Math.random().toString(36).slice(2, 8),
          order_id: orderId,
          product_slug: p.slug,
          name_en: p.name.en,
          name_ar: p.name.ar,
          qty: i.qty,
          unit_price: p.price,
          line_total: p.price * i.qty,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (!lines.length) throw new Error("No valid items in order");

    const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
    const delivery = data.payment === "pickup" ? 0 : DELIVERY_FEE_JUBA;
    const total = subtotal + delivery;
    const orderNumber =
      "BBM-" +
      Date.now().toString(36).toUpperCase().slice(-6) +
      Math.floor(Math.random() * 90 + 10);

    const now = new Date().toISOString();
    const newOrder: Order = {
      id: orderId,
      order_number: orderNumber,
      customer_name: data.customerName,
      phone: data.phone,
      phone2: data.phone2 || null,
      address: data.payment === "pickup" ? null : data.address || null,
      area: data.payment === "pickup" ? null : data.area || null,
      city: data.city || "Juba",
      notes: data.notes || null,
      payment_method: data.payment,
      mpesa_txid: data.payment === "mpesa" ? data.txid || null : null,
      subtotal,
      delivery_fee: delivery,
      total,
      status: "new",
      created_at: now,
      updated_at: now,
      order_items: lines,
    };

    ordersStore.unshift(newOrder);

    return { orderNumber: newOrder.order_number, total: newOrder.total, subtotal, delivery };
  });

export const listOrders = createServerFn({ method: "GET" }).handler(async () => {
  return ordersStore;
});

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string(), status: z.enum(["new", "confirmed", "delivered", "cancelled"]) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const order = ordersStore.find((o) => o.id === data.id);
    if (order) {
      order.status = data.status;
      order.updated_at = new Date().toISOString();
    }
    return { ok: true };
  });
