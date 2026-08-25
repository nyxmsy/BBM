import type { LucideIcon } from "lucide-react";
import {
  CookingPot,
  Droplets,
  Footprints,
  Handbag,
  House,
  Package,
  Sparkles,
  SprayCan,
  UtensilsCrossed,
} from "lucide-react";
import type { CategorySlug } from "@/lib/products";

const CATEGORY_ICONS: Record<CategorySlug, LucideIcon> = {
  kitchen: UtensilsCrossed,
  cookware: CookingPot,
  bags: Handbag,
  shoes: Footprints,
  oils: Droplets,
  lotions: Sparkles,
  cleaning: SprayCan,
  household: House,
};

export function CategoryIcon({
  slug,
  className = "h-5 w-5",
}: {
  slug: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[slug as CategorySlug] ?? Package;
  return <Icon className={className} aria-hidden />;
}
