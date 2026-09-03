import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useCart } from "@/lib/cart";
import { useCatalog } from "@/lib/catalog";
import { useI18n, bilingual } from "@/lib/i18n";
import { formatSSP } from "@/lib/format";
import { ProductVisual } from "@/components/ProductTile";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag } from "lucide-react";
import { STORE } from "@/lib/store";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({
    meta: [
      { title: "Cart — BBM Household" },
      { name: "description", content: "Review items in your cart and proceed to checkout." },
      { property: "og:title", content: "Your Cart — BBM" },
      { property: "og:description", content: "Review your cart and check out." },
    ],
  }),
});

function CartPage() {
  const { items, setQty, remove } = useCart();
  const { t, lang } = useI18n();
  const { get } = useCatalog();

  const rows = items.map((i) => ({ item: i, product: get(i.slug) })).filter((r) => r.product);
  const subtotal = rows.reduce((s, r) => s + r.product!.price * r.item.qty, 0);
  const total = subtotal;

  if (rows.length === 0) {
    return (
      <Layout>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">{t("cart.empty")}</h1>
          <Link
            to="/shop"
            className="btn-tap mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            {t("cart.continue")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("cart.title")}</h1>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-3">
            {rows.map(({ item, product }) => (
              <li
                key={item.slug}
                className="grid grid-cols-[80px_1fr_auto] items-center gap-4 rounded-2xl border border-border/60 bg-card p-3 sm:grid-cols-[96px_1fr_auto]"
              >
                <Link
                  to="/product/$slug"
                  params={{ slug: product!.slug }}
                  className="aspect-square overflow-hidden rounded-xl"
                >
                  <ProductVisual product={product!} className="h-full w-full" />
                </Link>
                <div className="min-w-0">
                  <Link
                    to="/product/$slug"
                    params={{ slug: product!.slug }}
                    className="line-clamp-2 font-medium hover:text-primary"
                  >
                    {bilingual(product!.name, lang)}
                  </Link>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatSSP(product!.price, lang)}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="inline-flex items-center rounded-full border border-border">
                      <button
                        aria-label="Decrease"
                        onClick={() => setQty(item.slug, item.qty - 1)}
                        className="grid h-9 w-9 place-items-center"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold">{item.qty}</span>
                      <button
                        aria-label="Increase"
                        onClick={() => setQty(item.slug, item.qty + 1)}
                        className="grid h-9 w-9 place-items-center"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => remove(item.slug)}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> {t("cart.remove")}
                    </button>
                  </div>
                </div>
                <div className="text-end font-display text-lg font-semibold">
                  {formatSSP(product!.price * item.qty, lang)}
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="text-lg font-semibold">{t("checkout.summary")}</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>{t("cart.subtotal")}</dt>
                <dd>{formatSSP(subtotal, lang)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("cart.delivery")}</dt>
                <dd className="text-muted-foreground">—</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-between border-t border-border pt-4">
              <span className="text-base font-semibold">{t("cart.total")}</span>
              <span className="font-display text-xl font-bold">{formatSSP(total, lang)}</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {lang === "ar"
                ? "يتم احتساب رسوم التوصيل عند اختيار المنطقة في صفحة الدفع."
                : "Delivery fee is set when you choose an area at checkout."}
            </p>
            <Link
              to="/checkout"
              className="btn-tap mt-6 flex items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground"
            >
              {t("cart.checkout")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </Link>
            <Link
              to="/shop"
              className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground"
            >
              {t("cart.continue")}
            </Link>
          </aside>
        </div>
      </section>
    </Layout>
  );
}
