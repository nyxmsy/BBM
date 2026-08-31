import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServiceRoleClient, getUserScopedServerClient } from "../../supabase/client.server";
import type { ProductRow } from "@/lib/catalog.server";

type UserRoleRow = { role: "admin" | "staff" };

const withAuthToken = z.object({ accessToken: z.string().min(1) });

// Real admin/staff check using POST so JSON payloads are received reliably
export const getMyAccess = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => withAuthToken.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getUserScopedServerClient(data.accessToken);

      const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
      if (userError || !userData?.user) {
        return { isAdmin: false, isStaff: false };
      }

      const { data: roleRows, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);

      if (error || !roleRows) return { isAdmin: false, isStaff: false };

      const roles = (roleRows as UserRoleRow[]).map((r) => r.role);
      return {
        isAdmin: roles.includes("admin"),
        isStaff: roles.includes("admin") || roles.includes("staff"),
      };
    } catch {
      return { isAdmin: false, isStaff: false };
    }
  });

// First-admin bootstrap using service-role client
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => withAuthToken.parse(d))
  .handler(async ({ data }) => {
    try {
      const callerClient = getUserScopedServerClient(data.accessToken);
      const { data: userData, error: userError } = await callerClient.auth.getUser(
        data.accessToken,
      );
      if (userError || !userData?.user) {
        return { granted: false, error: "Not authenticated." };
      }

      const serviceClient = getServiceRoleClient();

      const { count, error: countError } = await serviceClient
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        return { granted: false, error: `Failed to check admins: ${countError.message}` };
      }

      if ((count ?? 0) > 0) {
        return { granted: false, error: "Admin already exists." };
      }

      const { error: insertError } = await serviceClient
        .from("user_roles")
        .insert({ user_id: userData.user.id, role: "admin" });

      if (insertError) {
        return { granted: false, error: `Failed to insert role: ${insertError.message}` };
      }

      return { granted: true, error: null };
    } catch (e: unknown) {
      return {
        granted: false,
        error: e instanceof Error ? e.message : "Unknown error occurred",
      };
    }
  });

const CATEGORY_TINT: Record<string, string> = {
  kitchen: "oklch(0.94 0.03 75)",
  cookware: "oklch(0.88 0.05 45)",
  bags: "oklch(0.86 0.06 35)",
  shoes: "oklch(0.88 0.05 240)",
  oils: "oklch(0.94 0.03 100)",
  lotions: "oklch(0.94 0.04 90)",
  cleaning: "oklch(0.93 0.04 200)",
  household: "oklch(0.9 0.05 70)",
};

export const productSchema = z.object({
  accessToken: z.string().min(1),
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
  tint: z.string().max(60).default("oklch(0.92 0.03 75)"),
  image_url: z.string().nullable().optional(),
  stock: z.number().int().min(0),
  featured: z.boolean().default(false),
  best_seller: z.boolean().default(false),
  new_arrival: z.boolean().default(false),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const listAllProducts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => withAuthToken.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getUserScopedServerClient(data.accessToken);
      const { data: rows, error } = await supabase
        .from("products")
        .select("*, product_images(id, product_id, image_url, sort_order, is_primary)")
        .order("sort_order", { ascending: true });

      if (!error && rows && rows.length > 0) {
        const productRows = rows as unknown as (ProductRow & {
          product_images?: { image_url: string }[];
        })[];
        return productRows.map((p) => ({
          slug: p.slug,
          name_en: p.name_en,
          name_ar: p.name_ar,
          desc_en: p.description_en ?? "",
          desc_ar: p.description_ar ?? "",
          price: Number(p.price),
          compare_at:
            p.compare_at_price !== null && p.compare_at_price !== undefined
              ? Number(p.compare_at_price)
              : null,
          category: p.category,
          tint: CATEGORY_TINT[p.category] ?? "oklch(0.92 0.03 75)",
          image_url: p.product_images?.[0]?.image_url ?? null,
          stock: p.stock,
          featured: p.is_featured,
          best_seller: p.is_best_seller,
          new_arrival: p.is_new_arrival,
          active: p.is_active,
          sort_order: p.sort_order,
        }));
      }
    } catch {
      // fallback below
    }
    const { defaultProductRows } = await import("@/lib/catalog.server");
    return defaultProductRows.map((p) => ({
      slug: p.slug,
      name_en: p.name_en,
      name_ar: p.name_ar,
      desc_en: p.description_en ?? "",
      desc_ar: p.description_ar ?? "",
      price: Number(p.price),
      compare_at:
        p.compare_at_price !== null && p.compare_at_price !== undefined
          ? Number(p.compare_at_price)
          : null,
          category: p.category,
          tint: CATEGORY_TINT[p.category] ?? "oklch(0.92 0.03 75)",
      image_url: null,
      stock: p.stock,
      featured: p.is_featured,
      best_seller: p.is_best_seller,
      new_arrival: p.is_new_arrival,
      active: p.is_active,
      sort_order: p.sort_order,
    }));
  });

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    const { data: product, error } = await supabase
      .from("products")
      .upsert(
        {
          slug: data.slug,
          name_en: data.name_en,
          name_ar: data.name_ar,
          description_en: data.desc_en,
          description_ar: data.desc_ar,
          price: data.price,
          compare_at_price: data.compare_at ?? null,
          category: data.category,
          stock: data.stock,
          is_featured: data.featured,
          is_best_seller: data.best_seller,
          is_new_arrival: data.new_arrival,
          is_active: data.active,
          sort_order: data.sort_order,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    if (error) throw new Error(`Failed to save product: ${error.message}`);

    if (data.image_url && product?.id) {
      await supabase.from("product_images").delete().eq("product_id", product.id);
      await supabase.from("product_images").insert({
        product_id: product.id,
        image_url: data.image_url,
        sort_order: 0,
        is_primary: true,
      });
    }

    return { ok: true };
  });

export const getInventoryDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => withAuthToken.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getUserScopedServerClient(data.accessToken);
      
      // Try to use the inventory_dashboard view first
      const { data: rows, error } = await supabase
        .from("inventory_dashboard")
        .select("*")
        .order("name_en", { ascending: true });

      if (!error && rows && rows.length > 0) {
        return rows as any[];
      }
      
      // Fallback to products table if view doesn't exist or returns no data
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, slug, name_en, name_ar, stock, price, category, is_active")
        .order("name_en", { ascending: true });

      if (productsError) throw productsError;
      
      // Transform products to match inventory dashboard format
      return (products as any[]).map(p => ({
        id: p.id,
        slug: p.slug,
        name_en: p.name_en,
        name_ar: p.name_ar,
        stock: p.stock,
        price: p.price,
        category: p.category,
        is_active: p.is_active,
        total_sold: 0,
        total_restored: 0,
        order_count: 0,
      }));
    } catch {
      return [];
    }
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ accessToken: z.string().min(1), slug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("slug", data.slug);
    if (error) throw new Error(`Failed to delete product: ${error.message}`);
    return { ok: true };
  });
