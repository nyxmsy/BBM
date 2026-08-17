import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getMyAccess = createServerFn({ method: "GET" }).handler(async () => {
  return { userId: "admin_user", roles: ["admin"], isStaff: true };
});

export const claimFirstAdmin = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ granted: boolean }> => {
    return { granted: true };
  },
);

const productSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  name_en: z.string().min(1).max(160),
  name_ar: z.string().min(1).max(160),
  desc_en: z.string().max(2000).default(""),
  desc_ar: z.string().max(2000).default(""),
  price: z.number().int().min(0),
  compare_at: z.number().int().min(0).nullable().optional(),
  category: z.string().min(1).max(40),
  emoji: z.string().max(8).default("📦"),
  tint: z.string().max(60).default("oklch(0.92 0.03 75)"),
  image_url: z.string().max(2000000).nullable().optional(),
  stock: z.number().int().min(0),
  featured: z.boolean().default(false),
  best_seller: z.boolean().default(false),
  new_arrival: z.boolean().default(false),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const listAllProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { getDbProducts } = await import("@/lib/catalog.server");
  return getDbProducts();
});

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data }) => {
    const { upsertDbProduct } = await import("@/lib/catalog.server");
    await upsertDbProduct(data);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { deleteDbProduct } = await import("@/lib/catalog.server");
    await deleteDbProduct(data.slug);
    return { ok: true };
  });
