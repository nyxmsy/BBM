import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { CATEGORIES } from "@/lib/products";
import { useCatalog } from "@/lib/catalog";
import { useI18n, bilingual } from "@/lib/i18n";

export const Route = createFileRoute("/categories")({
  component: Categories,
  head: () => ({
    meta: [
      { title: "Categories — BBM Household" },
      {
        name: "description",
        content:
          "Browse categories: kitchen, cookware, bags, shoes, oils, lotions, cleaning and household essentials.",
      },
      { property: "og:title", content: "Categories — BBM Household" },
      { property: "og:description", content: "Shop by category at BBM." },
    ],
  }),
});

function Categories() {
  const { t, lang } = useI18n();
  const { byCategory } = useCatalog();
  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("cats.title")}</h1>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const count = byCategory(c.slug).length;
            return (
              <Link
                key={c.slug}
                to="/shop"
                search={{ cat: c.slug } as never}
                className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-border/60 bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-4xl"
                  style={{ background: c.tint }}
                >
                  {c.emoji}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold">{bilingual(c.name, lang)}</div>
                  <div className="text-sm text-muted-foreground">
                    {count} {lang === "ar" ? "منتج" : "products"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </Layout>
  );
}
