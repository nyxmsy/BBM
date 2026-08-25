import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CategorySlug, Product } from "@/lib/products";
import { getAnonServerClient, getUserScopedServerClient } from "../../supabase/client.server";

// ============================================================================
// Types matching the live Supabase schema
// ============================================================================

export type ProductImageRow = {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
};

export type ProductRow = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  stock: number;
  category: string;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  product_images?: ProductImageRow[];
};

type ProductIdLookupRow = { id: string; slug: string };

const CATEGORY_EMOJI: Record<string, string> = {
  kitchen: "🍽️",
  cookware: "🍳",
  bags: "👜",
  shoes: "👟",
  oils: "🥥",
  lotions: "🧴",
  cleaning: "🧼",
  household: "🧺",
};

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

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

export function mapProduct(r: ProductRow): Product {
  const images = (r.product_images ?? [])
    .slice()
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.sort_order - b.sort_order;
    })
    .map((img) => img.image_url);

  return {
    slug: r.slug,
    name: { en: r.name_en, ar: r.name_ar },
    desc: { en: r.description_en ?? "", ar: r.description_ar ?? "" },
    price: toNumber(r.price),
    compareAt:
      r.compare_at_price !== null && r.compare_at_price !== undefined
        ? toNumber(r.compare_at_price)
        : undefined,
    category: r.category as CategorySlug,
    emoji: CATEGORY_EMOJI[r.category] ?? "📦",
    tint: CATEGORY_TINT[r.category] ?? "oklch(0.92 0.03 75)",
    imageUrl: images[0],
    images,
    stock: r.stock,
    featured: r.is_featured,
    bestSeller: r.is_best_seller,
    newArrival: r.is_new_arrival,
  };
}

export const defaultProductRows: ProductRow[] = [
  {
    id: "prod_1",
    slug: "ceramic-dinner-set-24",
    name_en: "Ceramic Dinner Set — 24 pieces",
    name_ar: "طقم عشاء سيراميك — 24 قطعة",
    description_en:
      "Elegant 24-piece ceramic dinner set for six. Chip-resistant and dishwasher safe. Perfect for family gatherings.",
    description_ar:
      "طقم عشاء سيراميك أنيق مكوّن من 24 قطعة يكفي لستة أشخاص. مقاوم للكسر وآمن للغسالة. مثالي لتجمعات العائلة.",
    price: 85000,
    compare_at_price: 105000,
    category: "kitchen",
    stock: 12,
    is_featured: true,
    is_best_seller: true,
    is_new_arrival: false,
    is_active: true,
    sort_order: 0,
  },
  {
    id: "prod_2",
    slug: "non-stick-pan-28",
    name_en: "Non-Stick Frying Pan 28cm",
    name_ar: "مقلاة غير لاصقة 28 سم",
    description_en:
      "Heavy-base non-stick frying pan with soft-touch handle. Even heat, easy to clean.",
    description_ar:
      "مقلاة قاعدة سميكة بطبقة غير لاصقة ومقبض مريح. توزيع حرارة ممتاز وسهلة التنظيف.",
    price: 28000,
    compare_at_price: null,
    category: "cookware",
    stock: 20,
    is_featured: true,
    is_best_seller: false,
    is_new_arrival: true,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "prod_3",
    slug: "cast-iron-pot-5l",
    name_en: "Cast Iron Cooking Pot — 5L",
    name_ar: "قدر حديد للطبخ — 5 لتر",
    description_en: "Durable 5-litre cast iron pot for stews, soups and everyday cooking.",
    description_ar: "قدر حديد متين سعة 5 لتر للحساء والطبخ اليومي.",
    price: 65000,
    compare_at_price: null,
    category: "cookware",
    stock: 8,
    is_featured: true,
    is_best_seller: false,
    is_new_arrival: false,
    is_active: true,
    sort_order: 2,
  },
  {
    id: "prod_4",
    slug: "leather-tote-bag",
    name_en: "Everyday Leather Tote",
    name_ar: "حقيبة يد جلدية يومية",
    description_en: "Spacious tote in soft brown leather. Roomy for shopping and everyday use.",
    description_ar: "حقيبة واسعة من الجلد البني الناعم مناسبة للتسوق والاستخدام اليومي.",
    price: 42000,
    compare_at_price: null,
    category: "bags",
    stock: 15,
    is_featured: true,
    is_best_seller: true,
    is_new_arrival: false,
    is_active: true,
    sort_order: 3,
  },
  {
    id: "prod_5",
    slug: "school-backpack",
    name_en: "Student Backpack",
    name_ar: "حقيبة ظهر للطلاب",
    description_en: "Sturdy backpack with padded straps and laptop sleeve.",
    description_ar: "حقيبة ظهر متينة بأحزمة مبطنة وجيب للكمبيوتر المحمول.",
    price: 22000,
    compare_at_price: null,
    category: "bags",
    stock: 30,
    is_featured: false,
    is_best_seller: false,
    is_new_arrival: true,
    is_active: true,
    sort_order: 4,
  },
  {
    id: "prod_6",
    slug: "womens-sandals",
    name_en: "Women's Comfort Sandals",
    name_ar: "صندل نسائي مريح",
    description_en: "Soft footbed sandals designed for all-day comfort.",
    description_ar: "صندل بنعل ناعم للراحة طوال اليوم.",
    price: 18000,
    compare_at_price: null,
    category: "shoes",
    stock: 22,
    is_featured: false,
    is_best_seller: false,
    is_new_arrival: false,
    is_active: true,
    sort_order: 5,
  },
  {
    id: "prod_7",
    slug: "mens-loafers",
    name_en: "Men's Everyday Loafers",
    name_ar: "حذاء رجالي يومي",
    description_en: "Classic slip-on loafers in brown leather.",
    description_ar: "حذاء كلاسيكي بدون رباط من الجلد البني.",
    price: 35000,
    compare_at_price: null,
    category: "shoes",
    stock: 14,
    is_featured: false,
    is_best_seller: true,
    is_new_arrival: false,
    is_active: true,
    sort_order: 6,
  },
  {
    id: "prod_8",
    slug: "coconut-body-oil-250",
    name_en: "Pure Coconut Body Oil — 250ml",
    name_ar: "زيت جوز الهند للجسم — 250 مل",
    description_en: "Cold-pressed coconut oil for skin and hair. 100% natural.",
    description_ar: "زيت جوز الهند المعصور على البارد للبشرة والشعر. طبيعي 100%.",
    price: 6500,
    compare_at_price: null,
    category: "oils",
    stock: 60,
    is_featured: true,
    is_best_seller: false,
    is_new_arrival: false,
    is_active: true,
    sort_order: 7,
  },
  {
    id: "prod_9",
    slug: "shea-lotion-400",
    name_en: "Shea Butter Lotion — 400ml",
    name_ar: "لوشن زبدة الشيا — 400 مل",
    description_en: "Deep-moisturising shea butter body lotion for daily use.",
    description_ar: "لوشن زبدة الشيا المرطب بعمق للاستخدام اليومي.",
    price: 8500,
    compare_at_price: null,
    category: "lotions",
    stock: 40,
    is_featured: false,
    is_best_seller: true,
    is_new_arrival: true,
    is_active: true,
    sort_order: 8,
  },
  {
    id: "prod_10",
    slug: "multi-surface-cleaner",
    name_en: "Multi-Surface Cleaner — 1L",
    name_ar: "منظف متعدد الأسطح — 1 لتر",
    description_en: "Powerful, gentle-scent cleaner for kitchens and bathrooms.",
    description_ar: "منظف قوي برائحة لطيفة للمطابخ والحمامات.",
    price: 4500,
    compare_at_price: null,
    category: "cleaning",
    stock: 80,
    is_featured: false,
    is_best_seller: false,
    is_new_arrival: false,
    is_active: true,
    sort_order: 9,
  },
  {
    id: "prod_11",
    slug: "storage-basket-set",
    name_en: "Woven Storage Basket Set — 3",
    name_ar: "طقم سلال تخزين مضفرة — 3",
    description_en: "Set of three hand-woven storage baskets. Great for laundry and organising.",
    description_ar: "ثلاث سلال مضفرة يدويًا. مثالية للغسيل والتنظيم.",
    price: 32000,
    compare_at_price: null,
    category: "household",
    stock: 10,
    is_featured: true,
    is_best_seller: false,
    is_new_arrival: true,
    is_active: true,
    sort_order: 10,
  },
  {
    id: "prod_12",
    slug: "stainless-flask-1l",
    name_en: "Stainless Steel Flask — 1L",
    name_ar: "ترمس ستانلس ستيل — 1 لتر",
    description_en: "Keeps drinks hot for 12 hours and cold for 24. Leak-proof.",
    description_ar: "يحافظ على السخونة 12 ساعة والبرودة 24 ساعة. لا يسرّب.",
    price: 15000,
    compare_at_price: null,
    category: "household",
    stock: 0,
    is_featured: false,
    is_best_seller: false,
    is_new_arrival: false,
    is_active: true,
    sort_order: 11,
  },
];

export const defaultCatalogProducts: Product[] = defaultProductRows.map(mapProduct);

// ============================================================================
// Public storefront reads — anon key, RLS allows is_active = true rows only
// ============================================================================

export async function fetchProducts(): Promise<Product[]> {
  try {
    const supabase = getAnonServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(id, product_id, image_url, sort_order, is_primary)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return (data as unknown as ProductRow[]).map(mapProduct);
    }
  } catch (e) {
    console.warn("fetchProducts fallback:", e);
  }
  return defaultCatalogProducts;
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const supabase = getAnonServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(id, product_id, image_url, sort_order, is_primary)")
      .eq("is_active", true)
      .eq("slug", slug)
      .maybeSingle();

    if (!error && data) {
      return mapProduct(data as unknown as ProductRow);
    }
  } catch (e) {
    console.warn("fetchProductBySlug fallback:", e);
  }
  const fallback = defaultCatalogProducts.find((p) => p.slug === slug);
  return fallback || null;
}

/** Used by checkout to resolve cart slugs -> product IDs. */
export async function lookupActiveProductIdsBySlug(slugs: string[]): Promise<ProductIdLookupRow[]> {
  try {
    const supabase = getAnonServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, slug")
      .in("slug", slugs)
      .eq("is_active", true);

    if (!error && data && data.length > 0) {
      return data as ProductIdLookupRow[];
    }
  } catch {
    // fallback below
  }
  return defaultProductRows
    .filter((p) => slugs.includes(p.slug) && p.is_active)
    .map((p) => ({ id: p.id, slug: p.slug }));
}

const withAuthToken = z.object({ accessToken: z.string().min(1) });

export const getDbProducts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => withAuthToken.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getUserScopedServerClient(data.accessToken);
      const { data: rows, error } = await supabase
        .from("products")
        .select("*, product_images(id, product_id, image_url, sort_order, is_primary)")
        .order("sort_order", { ascending: true });

      if (!error && rows && rows.length > 0) {
        return rows as unknown as ProductRow[];
      }
    } catch {
      // fallback
    }
    return defaultProductRows;
  });

const upsertProductSchema = z.object({
  accessToken: z.string().min(1),
  slug: z.string().min(1),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).nullable().optional(),
  category: z.string().min(1),
  stock: z.number().int().min(0),
  imageUrl: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const upsertDbProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertProductSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);

    const { data: product, error: upsertError } = await supabase
      .from("products")
      .upsert(
        {
          slug: data.slug,
          name_en: data.nameEn,
          name_ar: data.nameAr,
          description_en: data.descriptionEn ?? "",
          description_ar: data.descriptionAr ?? "",
          price: data.price,
          compare_at_price: data.compareAtPrice ?? null,
          category: data.category,
          stock: data.stock,
          is_featured: data.isFeatured ?? false,
          is_best_seller: data.isBestSeller ?? false,
          is_new_arrival: data.isNewArrival ?? false,
          is_active: data.isActive ?? true,
          sort_order: data.sortOrder ?? 0,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    if (upsertError) throw new Error(`Failed to save product: ${upsertError.message}`);
    return { ok: true, id: product.id };
  });

export const deleteDbProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ accessToken: z.string().min(1), slug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = getUserScopedServerClient(data.accessToken);
    const { error } = await supabase
      .from("products")
      .update({ active: false })
      .eq("slug", data.slug);
    if (error) throw new Error(`Failed to delete product: ${error.message}`);
    return { ok: true };
  });
