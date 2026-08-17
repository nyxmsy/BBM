import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/catalog.functions";
import type { CategorySlug, Product } from "@/lib/products";

export const productsQueryOptions = queryOptions({
  queryKey: ["products"],
  queryFn: () => listProducts(),
  staleTime: 60_000,
});

export function useCatalog() {
  const { data: products } = useSuspenseQuery(productsQueryOptions);
  return {
    products,
    get: (slug: string): Product | undefined => products.find((p) => p.slug === slug),
    byCategory: (slug: CategorySlug) => products.filter((p) => p.category === slug),
    related: (p: Product, limit = 4) =>
      products.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, limit),
  };
}
