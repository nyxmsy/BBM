import { createServerFn } from "@tanstack/react-start";

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchProducts } = await import("@/lib/catalog.server");
  return fetchProducts();
});

export const getProductBySlugFn = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data }) => {
    const { fetchProductBySlug } = await import("@/lib/catalog.server");
    return fetchProductBySlug(data);
  });
