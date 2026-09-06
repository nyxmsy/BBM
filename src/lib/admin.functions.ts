import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServiceRoleClient, getUserScopedServerClient } from "../../supabase/client.server";
import type { ProductRow } from "@/lib/catalog.server";

function parseWithDataOrDirect<T extends z.ZodTypeAny>(schema: T, d: unknown): z.infer<T> {
  if (d && typeof d === "object" && "data" in d && (d as { data: unknown }).data !== undefined) {
    return schema.parse((d as { data: unknown }).data);
  }
  return schema.parse(d);
}

type UserRoleRow = { role: "admin" | "staff" };

const withAuthToken = z.object({ accessToken: z.string().min(1) });

// Real admin/staff check using POST so JSON payloads are received reliably
export const getMyAccess = createServerFn({ method: "POST" })
  .validator((d: unknown) => parseWithDataOrDirect(withAuthToken, d))
  .handler(async ({ data }) => {
    try {
      const supabase = getUserScopedServerClient(data.accessToken);
      const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
      if (userError) {
        console.error("[getMyAccess] auth.getUser error:", userError);
        return { isAdmin: false, isStaff: false, _debug: `auth error: ${userError.message}` };
      }
      if (!userData?.user) {
        return { isAdmin: false, isStaff: false, _debug: "no user from token" };
      }

      const serviceClient = getServiceRoleClient();
      const { data: roleRows, error } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);

      if (error) {
        console.error("[getMyAccess] user_roles query error:", error);
        return { isAdmin: false, isStaff: false, _debug: `db error: ${error.message}` };
      }
      if (!roleRows) {
        return { isAdmin: false, isStaff: false, _debug: `no roles for uid=${userData.user.id}` };
      }

      const roles = (roleRows as UserRoleRow[]).map((r) => r.role);
      return {
        isAdmin: roles.includes("admin"),
        isStaff: roles.includes("admin") || roles.includes("staff"),
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[getMyAccess] unexpected exception:", msg);
      return { isAdmin: false, isStaff: false, _debug: `exception: ${msg}` };
    }
  });

// First-admin bootstrap using service-role client
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => parseWithDataOrDirect(withAuthToken, d))
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
  remove_photo: z.boolean().optional(),
  stock: z.number().int().min(0),
  featured: z.boolean().default(false),
  best_seller: z.boolean().default(false),
  new_arrival: z.boolean().default(false),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const listAllProducts = createServerFn({ method: "POST" })
  .validator((d: unknown) => parseWithDataOrDirect(withAuthToken, d))
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
          image_url: string | null;
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
          image_url: p.image_url,
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
      image_url: p.image_url,
      stock: p.stock,
      featured: p.is_featured,
      best_seller: p.is_best_seller,
      new_arrival: p.is_new_arrival,
      active: p.is_active,
      sort_order: p.sort_order,
    }));
  });

export const saveProduct = createServerFn({ method: "POST" })
  .validator((d: unknown) => parseWithDataOrDirect(productSchema, d))
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    const resolvedImageUrl = data.remove_photo ? null : (data.image_url ?? null);

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
          image_url: resolvedImageUrl,
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

    // Mirror the primary photo into product_images for old storefront code paths.
    if (product?.id) {
      await supabase.from("product_images").delete().eq("product_id", product.id);
      if (resolvedImageUrl) {
        await supabase.from("product_images").insert({
          product_id: product.id,
          image_url: resolvedImageUrl,
          sort_order: 0,
          is_primary: true,
        });
      }
    }

    return { ok: true };
  });

export const getInventoryDashboard = createServerFn({ method: "POST" })
  .validator((d: unknown) => parseWithDataOrDirect(withAuthToken, d))
  .handler(async ({ data }) => {
    try {
      const supabase = getUserScopedServerClient(data.accessToken);

      // Try to use the inventory_dashboard view first
      const { data: rows, error } = await supabase
        .from("inventory_dashboard")
        .select("*")
        .order("name_en", { ascending: true });

      if (!error && rows && rows.length > 0) {
        return rows as Array<{
          id: string;
          slug: string;
          name_en: string;
          name_ar: string;
          stock: number;
          price: number;
          category: string;
          is_active: boolean;
          total_sold: number;
          total_restored: number;
          order_count: number;
        }>;
      }

      // Fallback to products table if view doesn't exist or returns no data
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, slug, name_en, name_ar, stock, price, category, is_active")
        .order("name_en", { ascending: true });

      if (productsError) throw productsError;

      // Transform products to match inventory dashboard format
      return (
        products as Array<{
          id: string;
          slug: string;
          name_en: string;
          name_ar: string;
          stock: number;
          price: number;
          category: string;
          is_active: boolean;
        }>
      ).map((p) => ({
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
  .validator((d: unknown) =>
    parseWithDataOrDirect(z.object({ accessToken: z.string().min(1), slug: z.string().min(1) }), d),
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

// ============================================================================
// Delivery areas (staff CRUD + public read of active list)
// ============================================================================

export type DeliveryArea = {
  id: string;
  name_en: string;
  name_ar: string | null;
  fee: number;
  active: boolean;
  sort_order: number;
};

export const listDeliveryAreas = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const raw = d && typeof d === "object" && "data" in d ? (d as { data: unknown }).data : d;
    const schema = z.object({
      accessToken: z.string().min(1).optional(),
      includeInactive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { accessToken: undefined, includeInactive: false };
    return {
      accessToken: parsed.data.accessToken,
      includeInactive: parsed.data.includeInactive ?? false,
    };
  })
  .handler(async ({ data }) => {
    const client = data.accessToken
      ? getUserScopedServerClient(data.accessToken)
      : getServiceRoleClient();
    let q = client
      .from("delivery_areas")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name_en", { ascending: true });

    if (!data.accessToken || !data.includeInactive) {
      q = q.eq("active", true);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as DeliveryArea[];
  });

export const saveDeliveryArea = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    parseWithDataOrDirect(
      z.object({
        accessToken: z.string().min(1),
        id: z.string().uuid().optional(),
        name_en: z.string().min(1).max(80),
        name_ar: z.string().max(80).optional(),
        fee: z.number().int().min(0),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      }),
      d,
    ),
  )
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    const payload = {
      name_en: data.name_en,
      name_ar: data.name_ar ?? null,
      fee: data.fee,
      active: data.active,
      sort_order: data.sort_order,
      updated_at: new Date().toISOString(),
    };
    let result;
    if (data.id) {
      result = await supabase
        .from("delivery_areas")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
    } else {
      result = await supabase.from("delivery_areas").insert(payload).select("*").single();
    }
    if (result.error) throw new Error(result.error.message);
    return { ok: true, area: result.data as DeliveryArea };
  });

export const deleteDeliveryArea = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    parseWithDataOrDirect(z.object({ accessToken: z.string().min(1), id: z.string().uuid() }), d),
  )
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    const { error } = await supabase.from("delivery_areas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// Store settings
// ============================================================================

export type StoreSettings = {
  id: number;
  store_name_en: string;
  store_name_ar: string;
  address_en: string;
  address_ar: string;
  opening_hours_en: string;
  opening_hours_ar: string;
  phone: string;
  whatsapp: string;
  email: string;
  map_lat: number | null;
  map_lng: number | null;
  map_embed_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  pickup_window_days: number;
  updated_at: string;
};

export const getStoreSettings = createServerFn({ method: "POST" })
  .validator((_d: unknown) => undefined)
  .handler(async () => {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const seeded = await supabase.from("store_settings").insert({ id: 1 }).select("*").single();
      if (seeded.error) throw new Error(seeded.error.message);
      return seeded.data as StoreSettings;
    }
    return data as StoreSettings;
  });

const storeSettingsPayloadSchema = z.object({
  accessToken: z.string().min(1),
  store_name_en: z.string().max(120).min(1),
  store_name_ar: z.string().max(120).default(""),
  address_en: z.string().max(240).default(""),
  address_ar: z.string().max(240).default(""),
  opening_hours_en: z.string().max(240).default(""),
  opening_hours_ar: z.string().max(240).default(""),
  phone: z.string().max(60).default(""),
  whatsapp: z.string().max(60).default(""),
  email: z.string().max(120).default(""),
  map_lat: z.number().nullable().optional(),
  map_lng: z.number().nullable().optional(),
  map_embed_url: z.string().max(1000).nullable().optional(),
  facebook_url: z
    .string()
    .max(300)
    .nullable()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), "Facebook URL must start with http(s)://"),
  tiktok_url: z
    .string()
    .max(300)
    .nullable()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), "TikTok URL must start with http(s)://"),
  pickup_window_days: z.number().int().min(1).max(30),
});

export const saveStoreSettings = createServerFn({ method: "POST" })
  .validator((d: unknown) => parseWithDataOrDirect(storeSettingsPayloadSchema, d))
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    const payload: Record<string, unknown> = {
      store_name_en: data.store_name_en,
      store_name_ar: data.store_name_ar,
      address_en: data.address_en,
      address_ar: data.address_ar,
      opening_hours_en: data.opening_hours_en,
      opening_hours_ar: data.opening_hours_ar,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      map_lat: data.map_lat ?? null,
      map_lng: data.map_lng ?? null,
      map_embed_url: data.map_embed_url ?? null,
      facebook_url: data.facebook_url?.trim() || null,
      tiktok_url: data.tiktok_url?.trim() || null,
      pickup_window_days: data.pickup_window_days,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("store_settings").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
