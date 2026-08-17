import { Link } from "@tanstack/react-router";
import { Home, ShoppingBag, Layers, Sparkles, ShoppingCart, Heart } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";

export function BottomNav() {
  const { t, lang } = useI18n();
  const { count } = useCart();
  const { items: wishlistItems } = useWishlist();

  return (
    <nav
      aria-label="Mobile Navigation Dock"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-border/60 bg-background/90 backdrop-blur-lg shadow-lg pb-safe"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {/* Home */}
        <Link
          to="/"
          activeOptions={{ exact: true }}
          activeProps={{ className: "text-primary font-semibold" }}
          inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
          className="flex flex-1 flex-col items-center justify-center py-1 text-center transition active:scale-95"
        >
          <Home className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] leading-tight">{t("nav.home")}</span>
        </Link>

        {/* Shop */}
        <Link
          to="/shop"
          activeOptions={{ exact: true }}
          activeProps={{ className: "text-primary font-semibold" }}
          inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
          className="flex flex-1 flex-col items-center justify-center py-1 text-center transition active:scale-95"
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] leading-tight">{t("nav.shop")}</span>
        </Link>

        {/* Categories */}
        <Link
          to="/categories"
          activeProps={{ className: "text-primary font-semibold" }}
          inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
          className="flex flex-1 flex-col items-center justify-center py-1 text-center transition active:scale-95"
        >
          <Layers className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] leading-tight">{t("nav.categories")}</span>
        </Link>

        {/* New Arrivals */}
        <Link
          to="/shop"
          search={{ filter: "new" } as never}
          activeProps={{ className: "text-primary font-semibold" }}
          inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
          className="relative flex flex-1 flex-col items-center justify-center py-1 text-center transition active:scale-95"
        >
          <div className="relative">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
          </div>
          <span className="mt-0.5 text-[10px] leading-tight text-emerald-600 dark:text-emerald-400 font-medium">
            {lang === "ar" ? "الجديد" : "New"}
          </span>
        </Link>

        {/* Wishlist */}
        <Link
          to="/wishlist"
          activeProps={{ className: "text-primary font-semibold" }}
          inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
          className="relative flex flex-1 flex-col items-center justify-center py-1 text-center transition active:scale-95"
        >
          <div className="relative">
            <Heart className="h-5 w-5" />
            {wishlistItems.length > 0 && (
              <span className="absolute -top-1.5 -end-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {wishlistItems.length}
              </span>
            )}
          </div>
          <span className="mt-0.5 text-[10px] leading-tight">{t("wishlist.title")}</span>
        </Link>

        {/* Cart */}
        <Link
          to="/cart"
          activeProps={{ className: "text-primary font-semibold" }}
          inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
          className="relative flex flex-1 flex-col items-center justify-center py-1 text-center transition active:scale-95"
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1.5 -end-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </div>
          <span className="mt-0.5 text-[10px] leading-tight">{t("nav.cart")}</span>
        </Link>
      </div>
    </nav>
  );
}
