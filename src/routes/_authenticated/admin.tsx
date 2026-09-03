import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess, claimFirstAdmin } from "@/lib/admin.functions";
import { auth } from "@/lib/auth";
import { BbmLogo } from "@/components/BbmLogo";
import {
  LogOut,
  Package,
  ShoppingBag,
  Loader2,
  Warehouse,
  Menu,
  X,
  Settings as SettingsIcon,
} from "lucide-react";
import { useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [
      { title: "Dashboard — BBM Household" },
      { name: "description", content: "Manage BBM products, stock and customer orders." },
      { property: "og:title", content: "Dashboard — BBM Household" },
      { property: "og:description", content: "Manage products and orders." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminLayout() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const accessFn = useServerFn(getMyAccess);
  const claimFn = useServerFn(claimFirstAdmin);
  const { lang, setLang, t, dir } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [claimErrorMsg, setClaimErrorMsg] = useState<string | null>(null);

  const langBtn = (l: Lang, label: string) => (
    <button
      key={l}
      type="button"
      onClick={() => setLang(l)}
      className={`rounded-full px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm font-medium transition ${
        lang === l
          ? "bg-foreground text-background font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  const {
    data,
    isLoading,
    error: accessError,
  } = useQuery({
    queryKey: ["access"],
    queryFn: async () => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("No active session — please sign in again.");
      }
      return await accessFn({ data: { accessToken: token } });
    },
    retry: false,
  });

  const claimMut = useMutation({
    mutationFn: async () => {
      setClaimErrorMsg(null);
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("No active session — please sign in again.");
      }
      const result = await claimFn({ data: { accessToken: token } });
      if (result && "error" in result && result.error) {
        throw new Error(String(result.error));
      }
      return result;
    },
    onSuccess: (res) => {
      if (res?.granted) {
        qc.invalidateQueries({ queryKey: ["access"] });
      }
    },
    onError: (err: Error) => {
      setClaimErrorMsg(err.message || "Failed to claim access.");
    },
  });

  const handleClaim = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    claimMut.mutate();
  };

  const signOut = async () => {
    await auth.signOut();
    qc.clear();
    nav({ to: "/auth" });
  };

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.isStaff) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-md rounded-3xl border border-border/60 bg-card p-7 text-center">
          <h1 className="text-xl font-bold">{t("admin.dashboard")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.noaccess")}</p>

          {accessError && (
            <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
              Access check: {accessError.message}
            </p>
          )}

          {(claimMut.isError || claimErrorMsg) && (
            <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
              {claimErrorMsg || claimMut.error?.message}
            </p>
          )}

          <button
            type="button"
            onClick={handleClaim}
            disabled={claimMut.isPending}
            className="btn-tap mt-5 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {claimMut.isPending ? "Claiming access…" : "Claim admin access"}
          </button>

          {claimMut.data?.granted === false && (
            <p className="mt-3 text-sm text-destructive">{t("admin.noaccess")}</p>
          )}

          <button
            type="button"
            onClick={signOut}
            className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {t("admin.signout")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border/60 bg-card sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/">
            <BbmLogo />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              to="/admin"
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-foreground text-background" }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <ShoppingBag className="h-4 w-4" /> {t("admin.orders")}
            </Link>
            <Link
              to="/admin/products"
              activeProps={{ className: "bg-foreground text-background" }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <Package className="h-4 w-4" /> {t("admin.products")}
            </Link>
            <Link
              to="/admin/inventory"
              activeProps={{ className: "bg-foreground text-background" }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <Warehouse className="h-4 w-4" /> {t("admin.inventory")}
            </Link>
            <Link
              to="/admin/settings"
              activeProps={{ className: "bg-foreground text-background" }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <SettingsIcon className="h-4 w-4" /> {t("admin.settings")}
            </Link>
            <div className="inline-flex items-center rounded-full border border-border/80 bg-card/80 p-0.5 ms-2">
              {langBtn("en", "EN")}
              {langBtn("ar", "ع")}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
              aria-label={t("admin.signout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="sm:hidden border-t border-border/60 bg-card px-4 py-4 space-y-2">
            <Link
              to="/admin"
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-foreground text-background" }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ShoppingBag className="h-4 w-4" /> {t("admin.orders")}
            </Link>
            <Link
              to="/admin/products"
              activeProps={{ className: "bg-foreground text-background" }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Package className="h-4 w-4" /> {t("admin.products")}
            </Link>
            <Link
              to="/admin/inventory"
              activeProps={{ className: "bg-foreground text-background" }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Warehouse className="h-4 w-4" /> {t("admin.inventory")}
            </Link>
            <Link
              to="/admin/settings"
              activeProps={{ className: "bg-foreground text-background" }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              <SettingsIcon className="h-4 w-4" /> {t("admin.settings")}
            </Link>
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-secondary/30 px-4 py-3">
              <span className="text-sm font-medium">{t("admin.language")}</span>
              <div className="inline-flex items-center rounded-full border border-border/80 bg-card/80 p-0.5">
                {langBtn("en", "EN")}
                {langBtn("ar", "ع")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                signOut();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> {t("admin.signout")}
            </button>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6" dir={dir}>
        <Outlet />
      </main>
    </div>
  );
}
