import { Link } from "@tanstack/react-router";
import type { Product } from "@/lib/products";
import { ProductVisual, PriceTag, ProductBadge, ProductName } from "./ProductTile";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group block overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-square">
        <ProductVisual
          product={product}
          className="h-full w-full transition group-hover:scale-[1.02]"
        />
        <ProductBadge product={product} />
      </div>
      <div className="space-y-2 p-4">
        <ProductName product={product} />
        <PriceTag product={product} />
      </div>
    </Link>
  );
}
