import type { CategorySlug, Product } from "@/lib/products";

export type ProductRow = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  desc_en: string;
  desc_ar: string;
  price: number;
  compare_at: number | null;
  category: string;
  emoji: string;
  tint: string;
  image_url: string | null;
  stock: number;
  featured: boolean;
  best_seller: boolean;
  new_arrival: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function mapProduct(r: ProductRow): Product {
  return {
    slug: r.slug,
    name: { en: r.name_en, ar: r.name_ar },
    desc: { en: r.desc_en, ar: r.desc_ar },
    price: r.price,
    compareAt: r.compare_at ?? undefined,
    category: r.category as CategorySlug,
    emoji: r.emoji,
    tint: r.tint,
    imageUrl: r.image_url ?? undefined,
    stock: r.stock,
    featured: r.featured,
    bestSeller: r.best_seller,
    newArrival: r.new_arrival,
  };
}

// Initial catalog pre-seeded from BBM inventory
const initialProducts: ProductRow[] = [
  {
    id: "prod_1",
    slug: "ceramic-dinner-set-24",
    name_en: "Ceramic Dinner Set — 24 pieces",
    name_ar: "طقم عشاء سيراميك — 24 قطعة",
    desc_en:
      "Elegant 24-piece ceramic dinner set for six. Chip-resistant and dishwasher safe. Perfect for family gatherings.",
    desc_ar:
      "طقم عشاء سيراميك أنيق مكوّن من 24 قطعة يكفي لستة أشخاص. مقاوم للكسر وآمن للغسالة. مثالي لتجمعات العائلة.",
    price: 85000,
    compare_at: 105000,
    category: "kitchen",
    emoji: "🍽️",
    tint: "oklch(0.94 0.03 75)",
    image_url: null,
    stock: 12,
    featured: true,
    best_seller: true,
    new_arrival: false,
    active: true,
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_2",
    slug: "non-stick-pan-28",
    name_en: "Non-Stick Frying Pan 28cm",
    name_ar: "مقلاة غير لاصقة 28 سم",
    desc_en: "Heavy-base non-stick frying pan with soft-touch handle. Even heat, easy to clean.",
    desc_ar: "مقلاة قاعدة سميكة بطبقة غير لاصقة ومقبض مريح. توزيع حرارة ممتاز وسهلة التنظيف.",
    price: 28000,
    compare_at: null,
    category: "cookware",
    emoji: "🍳",
    tint: "oklch(0.9 0.05 45)",
    image_url: null,
    stock: 20,
    featured: true,
    best_seller: false,
    new_arrival: true,
    active: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_3",
    slug: "cast-iron-pot-5l",
    name_en: "Cast Iron Cooking Pot — 5L",
    name_ar: "قدر حديد للطبخ — 5 لتر",
    desc_en: "Durable 5-litre cast iron pot for stews, soups and everyday cooking.",
    desc_ar: "قدر حديد متين سعة 5 لتر للحساء والطبخ اليومي.",
    price: 65000,
    compare_at: null,
    category: "cookware",
    emoji: "🥘",
    tint: "oklch(0.85 0.04 40)",
    image_url: null,
    stock: 8,
    featured: true,
    best_seller: false,
    new_arrival: false,
    active: true,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_4",
    slug: "leather-tote-bag",
    name_en: "Everyday Leather Tote",
    name_ar: "حقيبة يد جلدية يومية",
    desc_en: "Spacious tote in soft brown leather. Roomy for shopping and everyday use.",
    desc_ar: "حقيبة واسعة من الجلد البني الناعم مناسبة للتسوق والاستخدام اليومي.",
    price: 42000,
    compare_at: null,
    category: "bags",
    emoji: "👜",
    tint: "oklch(0.86 0.06 35)",
    image_url: null,
    stock: 15,
    featured: true,
    best_seller: true,
    new_arrival: false,
    active: true,
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_5",
    slug: "school-backpack",
    name_en: "Student Backpack",
    name_ar: "حقيبة ظهر للطلاب",
    desc_en: "Sturdy backpack with padded straps and laptop sleeve.",
    desc_ar: "حقيبة ظهر متينة بأحزمة مبطنة وجيب للكمبيوتر المحمول.",
    price: 22000,
    compare_at: null,
    category: "bags",
    emoji: "🎒",
    tint: "oklch(0.88 0.05 240)",
    image_url: null,
    stock: 30,
    featured: false,
    best_seller: false,
    new_arrival: true,
    active: true,
    sort_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_6",
    slug: "womens-sandals",
    name_en: "Women's Comfort Sandals",
    name_ar: "صندل نسائي مريح",
    desc_en: "Soft footbed sandals designed for all-day comfort.",
    desc_ar: "صندل بنعل ناعم للراحة طوال اليوم.",
    price: 18000,
    compare_at: null,
    category: "shoes",
    emoji: "👡",
    tint: "oklch(0.9 0.05 30)",
    image_url: null,
    stock: 22,
    featured: false,
    best_seller: false,
    new_arrival: false,
    active: true,
    sort_order: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_7",
    slug: "mens-loafers",
    name_en: "Men's Everyday Loafers",
    name_ar: "حذاء رجالي يومي",
    desc_en: "Classic slip-on loafers in brown leather.",
    desc_ar: "حذاء كلاسيكي بدون رباط من الجلد البني.",
    price: 35000,
    compare_at: null,
    category: "shoes",
    emoji: "👞",
    tint: "oklch(0.82 0.05 40)",
    image_url: null,
    stock: 14,
    featured: false,
    best_seller: true,
    new_arrival: false,
    active: true,
    sort_order: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_8",
    slug: "coconut-body-oil-250",
    name_en: "Pure Coconut Body Oil — 250ml",
    name_ar: "زيت جوز الهند للجسم — 250 مل",
    desc_en: "Cold-pressed coconut oil for skin and hair. 100% natural.",
    desc_ar: "زيت جوز الهند المعصور على البارد للبشرة والشعر. طبيعي 100%.",
    price: 6500,
    compare_at: null,
    category: "oils",
    emoji: "🥥",
    tint: "oklch(0.94 0.03 100)",
    image_url: null,
    stock: 60,
    featured: true,
    best_seller: false,
    new_arrival: false,
    active: true,
    sort_order: 7,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_9",
    slug: "shea-lotion-400",
    name_en: "Shea Butter Lotion — 400ml",
    name_ar: "لوشن زبدة الشيا — 400 مل",
    desc_en: "Deep-moisturising shea butter body lotion for daily use.",
    desc_ar: "لوشن زبدة الشيا المرطب بعمق للاستخدام اليومي.",
    price: 8500,
    compare_at: null,
    category: "lotions",
    emoji: "🧴",
    tint: "oklch(0.94 0.04 90)",
    image_url: null,
    stock: 40,
    featured: false,
    best_seller: true,
    new_arrival: true,
    active: true,
    sort_order: 8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_10",
    slug: "multi-surface-cleaner",
    name_en: "Multi-Surface Cleaner — 1L",
    name_ar: "منظف متعدد الأسطح — 1 لتر",
    desc_en: "Powerful, gentle-scent cleaner for kitchens and bathrooms.",
    desc_ar: "منظف قوي برائحة لطيفة للمطابخ والحمامات.",
    price: 4500,
    compare_at: null,
    category: "cleaning",
    emoji: "🧼",
    tint: "oklch(0.93 0.04 200)",
    image_url: null,
    stock: 80,
    featured: false,
    best_seller: false,
    new_arrival: false,
    active: true,
    sort_order: 9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_11",
    slug: "storage-basket-set",
    name_en: "Woven Storage Basket Set — 3",
    name_ar: "طقم سلال تخزين مضفرة — 3",
    desc_en: "Set of three hand-woven storage baskets. Great for laundry and organising.",
    desc_ar: "ثلاث سلال مضفرة يدويًا. مثالية للغسيل والتنظيم.",
    price: 32000,
    compare_at: null,
    category: "household",
    emoji: "🧺",
    tint: "oklch(0.9 0.05 70)",
    image_url: null,
    stock: 10,
    featured: true,
    best_seller: false,
    new_arrival: true,
    active: true,
    sort_order: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod_12",
    slug: "stainless-flask-1l",
    name_en: "Stainless Steel Flask — 1L",
    name_ar: "ترمس ستانلس ستيل — 1 لتر",
    desc_en: "Keeps drinks hot for 12 hours and cold for 24. Leak-proof.",
    desc_ar: "يحافظ على السخونة 12 ساعة والبرودة 24 ساعة. لا يسرّب.",
    price: 15000,
    compare_at: null,
    category: "household",
    emoji: "🫙",
    tint: "oklch(0.9 0.02 220)",
    image_url: null,
    stock: 0,
    featured: false,
    best_seller: false,
    new_arrival: false,
    active: true,
    sort_order: 11,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// In-memory data store for products (isolated, ready for database replacement)
let productsStore: ProductRow[] = [...initialProducts];

export async function fetchProducts(): Promise<Product[]> {
  return productsStore
    .filter((p) => p.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapProduct);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const row = productsStore.find((p) => p.active && p.slug === slug);
  return row ? mapProduct(row) : null;
}

export async function getDbProducts(): Promise<ProductRow[]> {
  return [...productsStore].sort((a, b) => a.sort_order - b.sort_order);
}

export async function upsertDbProduct(row: Partial<ProductRow> & { slug: string }): Promise<void> {
  const idx = productsStore.findIndex((p) => p.slug === row.slug);
  const now = new Date().toISOString();
  if (idx >= 0) {
    productsStore[idx] = {
      ...productsStore[idx],
      ...row,
      updated_at: now,
    } as ProductRow;
  } else {
    productsStore.push({
      id: "prod_" + Date.now().toString(36),
      slug: row.slug,
      name_en: row.name_en || "",
      name_ar: row.name_ar || "",
      desc_en: row.desc_en || "",
      desc_ar: row.desc_ar || "",
      price: row.price || 0,
      compare_at: row.compare_at ?? null,
      category: row.category || "kitchen",
      emoji: row.emoji || "📦",
      tint: row.tint || "oklch(0.92 0.03 75)",
      image_url: row.image_url ?? null,
      stock: row.stock ?? 0,
      featured: row.featured ?? false,
      best_seller: row.best_seller ?? false,
      new_arrival: row.new_arrival ?? false,
      active: row.active ?? true,
      sort_order: row.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    });
  }
}

export async function deleteDbProduct(slug: string): Promise<void> {
  productsStore = productsStore.filter((p) => p.slug !== slug);
}
