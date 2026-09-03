import type { Product } from "@/lib/products";
import { useI18n, bilingual } from "@/lib/i18n";
import { formatSSP } from "@/lib/format";
import { CategoryIcon } from "./CategoryIcon";

export function ProductVisual({
  product,
  className = "",
  fit = "cover",
}: {
  product: Product;
  className?: string;
  fit?: "cover" | "contain";
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 100% at 30% 20%, oklch(1 0 0 / 0.6), transparent 60%), ${product.tint}`,
      }}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-${fit}`}
        />
      ) : (
        <CategoryIcon
          slug={product.category}
          className="h-16 w-16 text-foreground/50 drop-shadow-sm sm:h-20 sm:w-20"
        />
      )}
    </div>
  );
}

export function PriceTag({ product }: { product: Product }) {
  const { lang } = useI18n();
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-lg font-semibold text-foreground">
        {formatSSP(product.price, lang)}
      </span>
      {product.compareAt && (
        <span className="text-sm text-muted-foreground line-through">
          {formatSSP(product.compareAt, lang)}
        </span>
      )}
    </div>
  );
}

export function ProductBadge({ product }: { product: Product }) {
  const { lang } = useI18n();
  const label =
    product.stock === 0
      ? lang === "ar"
        ? "غير متوفر"
        : "Out of stock"
      : product.newArrival
        ? lang === "ar"
          ? "جديد"
          : "New"
        : product.compareAt
          ? lang === "ar"
            ? "عرض"
            : "Sale"
          : product.bestSeller
            ? lang === "ar"
              ? "الأكثر مبيعًا"
              : "Best seller"
            : null;
  if (!label) return null;
  const tone =
    product.stock === 0
      ? "bg-foreground/80 text-background"
      : product.compareAt
        ? "bg-primary text-primary-foreground"
        : "bg-accent text-accent-foreground";
  return (
    <span className={`absolute top-3 start-3 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function ProductName({ product }: { product: Product }) {
  const { lang } = useI18n();
  return (
    <h3 className="line-clamp-2 text-base font-medium text-foreground">
      {bilingual(product.name, lang)}
    </h3>
  );
}
