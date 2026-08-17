import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES, type CategorySlug } from "@/lib/products";
import { useCatalog } from "@/lib/catalog";
import { useI18n, bilingual } from "@/lib/i18n";
import { useMemo } from "react";

const search = z.object({
  cat: z.string().optional(),
  q: z.string().optional(),
  filter: z.string().optional(),
});

export const Route = createFileRoute("/shop")({
  component: Shop,
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Shop — BBM Household" },
      {
        name: "description",
        content: "Browse all household products at BBM. Kitchenware, bags, shoes, oils and more.",
      },
      { property: "og:title", content: "Shop — BBM Household" },
      { property: "og:description", content: "Browse all household products at BBM." },
    ],
  }),
});

function Shop() {
  const { t, lang } = useI18n();
  const { cat, q, filter } = Route.useSearch();
  const { products } = useCatalog();
  const items = useMemo(() => {
    let list = products;
    if (cat) list = list.filter((p) => p.category === (cat as CategorySlug));
    if (filter === "new") list = list.filter((p) => p.newArrival);
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.en.toLowerCase().includes(needle) ||
          p.name.ar.includes(q) ||
          p.desc.en.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [products, cat, q, filter]);

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("shop.title")}</h1>
        {q && <p className="mt-2 text-muted-foreground">“{q}”</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/shop"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              !cat
                ? "bg-foreground text-background"
                : "bg-secondary text-foreground hover:bg-secondary/70"
            }`}
          >
            {t("shop.all")}
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/shop"
              search={{ cat: c.slug } as never}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                cat === c.slug
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground hover:bg-secondary/70"
              }`}
            >
              <span aria-hidden className="me-1">
                {c.emoji}
              </span>
              {bilingual(c.name, lang)}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">{t("search.none")}</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
