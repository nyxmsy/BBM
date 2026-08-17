import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { getProductBySlugFn } from "@/lib/catalog.functions";
import { useCatalog } from "@/lib/catalog";
import { useI18n, bilingual } from "@/lib/i18n";
import { formatSSP } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { ProductCard } from "@/components/ProductCard";
import { ProductVisual } from "@/components/ProductTile";
import { Heart, Share2, Minus, Plus, ShoppingBag, Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/product/$slug")({
  component: ProductPage,
  loader: async ({ params }) => {
    const product = await getProductBySlugFn({ data: params.slug });
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name.en} — BBM` },
          { name: "description", content: loaderData.product.desc.en },
          { property: "og:title", content: `${loaderData.product.name.en} — BBM` },
          { property: "og:description", content: loaderData.product.desc.en },
        ]
      : [],
  }),
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { related } = useCatalog();
  const { t, lang } = useI18n();
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock === 0;

  const onAdd = () => {
    add(product.slug, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const onShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: bilingual(product.name, lang), url });
      } catch (e) {
        void e;
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {
        void e;
      }
    }
  };

  const rel = related(product, 4);

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-3xl">
              <ProductVisual product={product} className="h-full w-full" />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden rounded-2xl border border-border/60"
                >
                  <ProductVisual product={product} className="h-full w-full" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground uppercase tracking-wide">
              {product.category}
            </div>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{bilingual(product.name, lang)}</h1>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold text-foreground">
                {formatSSP(product.price, lang)}
              </span>
              {product.compareAt && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatSSP(product.compareAt, lang)}
                </span>
              )}
            </div>

            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              {bilingual(product.desc, lang)}
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${outOfStock ? "bg-destructive" : "bg-emerald-500"}`}
              />
              {outOfStock ? t("product.out") : `${t("product.stock")} · ${product.stock}`}
            </div>

            {!outOfStock && (
              <div className="mt-6 flex items-center gap-3">
                <span className="text-sm font-medium">{t("product.qty")}</span>
                <div className="inline-flex items-center rounded-full border border-border">
                  <button
                    aria-label="Decrease"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="btn-tap grid place-items-center px-3"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center font-semibold">{qty}</span>
                  <button
                    aria-label="Increase"
                    onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                    className="btn-tap grid place-items-center px-3"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onAdd}
                disabled={outOfStock}
                className="btn-tap inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground disabled:opacity-50"
              >
                {added ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                {outOfStock ? t("product.out") : t("product.add")}
              </button>
              <button
                onClick={() => toggle(product.slug)}
                aria-label={t("product.wish")}
                className="btn-tap grid place-items-center rounded-full border border-border bg-card px-5"
              >
                <Heart
                  className={`h-5 w-5 ${has(product.slug) ? "fill-primary text-primary" : ""}`}
                />
              </button>
              <button
                onClick={onShare}
                aria-label={t("product.share")}
                className="btn-tap grid place-items-center rounded-full border border-border bg-card px-5"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {rel.length > 0 && (
          <div className="mt-20">
            <h2 className="text-2xl font-bold">{t("product.related")}</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {rel.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
