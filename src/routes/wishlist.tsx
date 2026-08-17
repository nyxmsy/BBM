import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useWishlist } from "@/lib/wishlist";
import { useCatalog } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";
import { useI18n } from "@/lib/i18n";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  component: Wishlist,
  head: () => ({
    meta: [
      { title: "Saved items — BBM" },
      { name: "description", content: "Your saved household items." },
      { property: "og:title", content: "Saved items — BBM" },
      { property: "og:description", content: "Your saved household items." },
    ],
  }),
});

function Wishlist() {
  const { items } = useWishlist();
  const { t } = useI18n();
  const { get } = useCatalog();
  const products = items.map((s) => get(s)).filter(Boolean);

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("wishlist.title")}</h1>
        {products.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary">
              <Heart className="h-7 w-7" />
            </div>
            <p className="mt-4 text-muted-foreground">{t("wishlist.empty")}</p>
            <Link
              to="/shop"
              className="btn-tap mt-6 inline-flex items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
            >
              {t("cart.continue")}
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p!.slug} product={p!} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
