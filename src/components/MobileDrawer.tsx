import { Link, useNavigate } from "@tanstack/react-router";
import {
  Home,
  ShoppingBag,
  Sparkles,
  Layers,
  Heart,
  Info,
  Phone,
  MessageCircle,
  X,
  Search,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useWishlist } from "@/lib/wishlist";
import { CATEGORIES } from "@/lib/products";
import { STORE } from "@/lib/store";
import { BbmLogo } from "./BbmLogo";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const { lang, setLang, t } = useI18n();
  const { items: wishlistItems } = useWishlist();
  const nav = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onClose();
      nav({ to: "/shop", search: { q: searchQuery.trim() } as never });
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t("nav.menu")}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Drawer Shell */}
      <div className="fixed inset-y-0 start-0 flex h-dvh w-[92%] max-w-sm flex-col overflow-hidden bg-background shadow-2xl animate-in slide-in-from-left duration-200 ease-out border-e border-border/60">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/60 px-4 py-3 bg-card/90 backdrop-blur-md">
          <Link to="/" onClick={onClose} className="inline-flex items-center">
            <BbmLogo />
          </Link>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-border/60 bg-secondary/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded-full px-2.5 py-1 font-semibold transition ${
                  lang === "en"
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`rounded-full px-2.5 py-1 font-semibold transition ${
                  lang === "ar"
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                عربي
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-tap grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5 space-y-4">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className="w-full rounded-xl border border-border/80 bg-secondary/40 ps-9 pe-3 py-2 text-xs outline-none transition focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground"
            />
          </form>

          {/* Nav Links */}
          <nav className="space-y-1">
            <Link
              to="/"
              onClick={onClose}
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
              inactiveProps={{ className: "text-foreground hover:bg-secondary/60" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
            >
              <Home className="h-4 w-4 shrink-0 text-blue-500" />
              <span>{t("nav.home")}</span>
            </Link>

            <Link
              to="/shop"
              onClick={onClose}
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
              inactiveProps={{ className: "text-foreground hover:bg-secondary/60" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
            >
              <ShoppingBag className="h-4 w-4 shrink-0 text-amber-500" />
              <span>{t("nav.shop")}</span>
            </Link>

            <Link
              to="/categories"
              onClick={onClose}
              activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
              inactiveProps={{ className: "text-foreground hover:bg-secondary/60" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
            >
              <Layers className="h-4 w-4 shrink-0 text-purple-500" />
              <span>{t("nav.categories")}</span>
            </Link>

            <Link
              to="/shop"
              search={{ filter: "new" } as never}
              onClick={onClose}
              activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
              inactiveProps={{ className: "text-foreground hover:bg-secondary/60" }}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{t("nav.new")}</span>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {lang === "ar" ? "جديد" : "Fresh"}
              </span>
            </Link>

            <Link
              to="/wishlist"
              onClick={onClose}
              activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
              inactiveProps={{ className: "text-foreground hover:bg-secondary/60" }}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition"
            >
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{t("wishlist.title")}</span>
              </div>
              {wishlistItems.length > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {wishlistItems.length}
                </span>
              )}
            </Link>

            <Link
              to="/about"
              onClick={onClose}
              activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
              inactiveProps={{ className: "text-foreground hover:bg-secondary/60" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
            >
              <Info className="h-4 w-4 shrink-0 text-cyan-500" />
              <span>{t("nav.about")}</span>
            </Link>
          </nav>

          {/* Departments / Categories */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {lang === "ar" ? "الأقسام" : "Departments"}
              </span>
              <Link
                to="/categories"
                onClick={onClose}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                {lang === "ar" ? "عرض الكل" : "View all"}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  to="/shop"
                  search={{ category: c.slug } as never}
                  onClick={onClose}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/30 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition active:scale-[0.98]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm shrink-0">{c.emoji}</span>
                    <span className="truncate">{lang === "ar" ? c.name.ar : c.name.en}</span>
                  </div>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60 rtl:rotate-180" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/60 bg-card/90 p-3.5 backdrop-blur space-y-2 pb-safe">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/${STORE.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tap flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">WhatsApp</span>
            </a>

            <a
              href={`tel:${STORE.phonePrimary}`}
              className="btn-tap flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary transition"
            >
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{lang === "ar" ? "اتصل بالمتجر" : "Call Store"}</span>
            </a>
          </div>

          <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-muted-foreground">
            <span className="truncate">Munuki Block B, Juba</span>

            <Link
              to="/auth"
              onClick={onClose}
              className="inline-flex shrink-0 items-center gap-0.5 hover:text-foreground"
            >
              <span>{lang === "ar" ? "دخول الموظفين" : "Staff"}</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
