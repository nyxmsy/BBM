import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, Heart, X, MapPin, Phone, Mail } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { BbmLogo } from "./BbmLogo";
import { WhatsAppFab } from "./WhatsAppFab";
import { MobileDrawer } from "./MobileDrawer";
import { WhatsAppIcon, whatsappHref } from "./WhatsAppIcon";
import { STORE } from "@/lib/store";

const NAV: { key: string; to: string }[] = [
  { key: "nav.home", to: "/" },
  { key: "nav.shop", to: "/shop" },
  { key: "nav.categories", to: "/categories" },
  { key: "nav.new", to: "/shop?filter=new" },
  { key: "nav.about", to: "/about" },
  { key: "nav.contact", to: "/contact" },
];

function LangSwitch() {
  const { lang, setLang } = useI18n();
  const btn = (l: Lang, label: string) => (
    <button
      key={l}
      type="button"
      onClick={() => setLang(l)}
      className={`rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium transition ${
        lang === l
          ? "bg-foreground text-background font-semibold shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center rounded-full border border-border/80 bg-card/80 p-0.5">
      {btn("en", "EN")}
      {btn("ar", "ع")}
    </div>
  );
}

function SearchButton() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { t } = useI18n();

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full text-foreground hover:bg-secondary transition"
      >
        <Search className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background p-4 pt-16 sm:pt-24 shadow-2xl animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && q.trim()) {
                    setOpen(false);
                    nav({ to: "/shop", search: { q: q.trim() } as never });
                  }
                }}
                placeholder={t("search.placeholder")}
                className="w-full bg-transparent py-2 text-base sm:text-lg outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary hover:bg-secondary/80 text-foreground"
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CartBadge() {
  const { count } = useCart();
  return (
    <Link
      to="/cart"
      className="relative inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full text-foreground hover:bg-secondary transition"
      aria-label="Cart"
    >
      <ShoppingBag className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -end-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}

function Header() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-secondary lg:hidden"
            aria-label={t("nav.menu")}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/">
            <BbmLogo />
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex lg:items-center lg:gap-6">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              activeProps={{ className: "text-foreground font-semibold" }}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>

        {/* Controls: Search, Wishlist, Cart & LangSwitch */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <SearchButton />

          <a
            href={whatsappHref(STORE.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("wa.help")}
            className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full text-[#25D366] hover:bg-secondary transition"
          >
            <WhatsAppIcon className="h-5 w-5" />
          </a>

          <Link
            to="/wishlist"
            aria-label="Wishlist"
            className="hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-secondary transition"
          >
            <Heart className="h-5 w-5" />
          </Link>

          <CartBadge />

          <div className="ms-1 shrink-0">
            <LangSwitch />
          </div>
        </div>
      </div>

      <MobileDrawer open={open} onClose={() => setOpen(false)} />
    </header>
  );
}

function Footer() {
  const { t, lang } = useI18n();
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <BbmLogo />
          <p className="mt-3 text-sm text-muted-foreground">{t("footer.tag")}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("nav.shop")}
          </h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/shop" className="hover:text-primary">
                {t("nav.shop")}
              </Link>
            </li>
            <li>
              <Link to="/categories" className="hover:text-primary">
                {t("nav.categories")}
              </Link>
            </li>
            <li>
              <Link to="/wishlist" className="hover:text-primary">
                {t("wishlist.title")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("nav.contact")}
          </h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" />{" "}
              {lang === "ar" ? STORE.address.ar : STORE.address.en}
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> {STORE.phonePrimary}
            </li>
            <li>
              <a
                href={whatsappHref(STORE.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary"
              >
                <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> {t("contact.whatsapp")}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> {STORE.email}
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("footer.hours")}
          </h4>
          <p className="mt-3 text-sm">{lang === "ar" ? STORE.hours.ar : STORE.hours.en}</p>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()} BBM · {t("footer.rights")}
        </p>
        <Link
          to="/auth"
          className="mt-2 inline-block text-[10px] tracking-wide text-muted-foreground/50 hover:text-muted-foreground"
        >
          {t("footer.staff")}
        </Link>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <Header />
      <main className="min-w-0 flex-1">{children}</main>
      <Footer />
      <WhatsAppFab />
    </div>
  );
}
