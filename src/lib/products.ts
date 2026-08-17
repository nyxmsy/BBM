export type CategorySlug =
  "kitchen" | "cookware" | "bags" | "shoes" | "oils" | "lotions" | "cleaning" | "household";

export type Category = {
  slug: CategorySlug;
  name: { en: string; ar: string };
  emoji: string;
  tint: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: "kitchen",
    name: { en: "Kitchen & Dishes", ar: "المطبخ والأطباق" },
    emoji: "🍽️",
    tint: "oklch(0.92 0.05 75)",
  },
  {
    slug: "cookware",
    name: { en: "Cookware", ar: "أواني الطهي" },
    emoji: "🍳",
    tint: "oklch(0.9 0.06 55)",
  },
  { slug: "bags", name: { en: "Bags", ar: "الحقائب" }, emoji: "👜", tint: "oklch(0.88 0.05 40)" },
  { slug: "shoes", name: { en: "Shoes", ar: "الأحذية" }, emoji: "👟", tint: "oklch(0.9 0.04 25)" },
  {
    slug: "oils",
    name: { en: "Body Oils", ar: "زيوت الجسم" },
    emoji: "🌿",
    tint: "oklch(0.92 0.06 95)",
  },
  {
    slug: "lotions",
    name: { en: "Lotions", ar: "المستحضرات" },
    emoji: "🧴",
    tint: "oklch(0.93 0.04 110)",
  },
  {
    slug: "cleaning",
    name: { en: "Cleaning Supplies", ar: "مستلزمات النظافة" },
    emoji: "🧼",
    tint: "oklch(0.92 0.03 200)",
  },
  {
    slug: "household",
    name: { en: "Household Essentials", ar: "أساسيات المنزل" },
    emoji: "🏠",
    tint: "oklch(0.9 0.04 60)",
  },
];

export type Product = {
  slug: string;
  name: { en: string; ar: string };
  desc: { en: string; ar: string };
  price: number;
  compareAt?: number;
  category: CategorySlug;
  emoji: string;
  tint: string;
  imageUrl?: string;
  stock: number;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
};

export function getProduct(products: Product[], slug: string) {
  return products.find((p) => p.slug === slug);
}
export function byCategory(products: Product[], slug: CategorySlug) {
  return products.filter((p) => p.category === slug);
}
export function related(products: Product[], p: Product, limit = 4) {
  return products.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, limit);
}
