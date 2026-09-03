import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layout } from "@/components/Layout";
import { auth } from "@/lib/auth";
import { listMyOrders, type OrderStatus } from "@/lib/orders.functions";
import { bilingual, useI18n, type Lang } from "@/lib/i18n";
import { formatSSP } from "@/lib/format";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/account")({
  ssr: false,
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "Your Account — BBM Household" },
      { name: "description", content: "View your BBM order history." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const input =
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";

const statusLabels: Record<string, string> = {
  new: "admin.new",
  processing: "admin.processing",
  completed: "admin.completed",
  picked_up: "admin.picked_up",
  delivered: "admin.delivered",
  cancelled: "admin.cancelled",
  confirmed: "admin.processing",
  out_for_delivery: "admin.out_for_delivery",
};

function AccountPage() {
  const { t, lang, setLang, dir } = useI18n();
  const nav = useNavigate();
  const fetchMine = useServerFn(listMyOrders);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setSessionReady(true);
    });
  }, []);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders"],
    enabled: signedIn,
    queryFn: async () => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return [];
      return fetchMine({ data: { accessToken: token } });
    },
  });

  const langBtn = (l: Lang, label: string) => (
    <button
      key={l}
      type="button"
      onClick={() => setLang(l)}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        lang === l
          ? "bg-foreground text-background font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
        const roles = await auth.getMyRoles();
        if (roles.isStaff) {
          nav({ to: "/admin" });
          return;
        }
        setSignedIn(true);
      } else {
        const { error } = await auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setMsg(t("account.success"));
        setMode("signin");
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (!sessionReady) {
    return (
      <Layout>
        <div className="grid min-h-[40vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!signedIn) {
    return (
      <Layout>
        <section className="mx-auto max-w-md px-4 py-12 sm:px-6">
          <div className="flex items-center justify-end">
            <div className="inline-flex items-center rounded-full border border-border/80 bg-card/80 p-0.5">
              {langBtn("en", "EN")}
              {langBtn("ar", "ع")}
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            {mode === "signin" ? t("account.title") : t("account.create")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("account.subtitle")}</p>
          <form onSubmit={submit} className="mt-6 space-y-3" dir={dir}>
            {mode === "signup" && (
              <input
                className={input}
                placeholder={t("checkout.name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
            <input
              className={input}
              type="email"
              required
              placeholder={t("staff.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className={input}
              type="password"
              required
              minLength={6}
              placeholder={t("staff.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {err && <p className="text-sm text-destructive">{err}</p>}
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
            <button
              type="submit"
              disabled={busy}
              className="btn-tap w-full rounded-full bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : mode === "signin" ? (
                t("account.signin")
              ) : (
                t("account.signup")
              )}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setErr(null);
            }}
            className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? t("account.noaccount") : t("account.haveaccount")}
          </button>
          <Link
            to="/shop"
            className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {t("account.guest")}
          </Link>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">{t("account.orders")}</h1>
          <button
            type="button"
            onClick={async () => {
              await auth.signOut();
              setSignedIn(false);
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("account.signout")}
          </button>
        </div>

        {isLoading ? (
          <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" />
        ) : !orders?.length ? (
          <p className="mt-10 text-muted-foreground">{t("account.empty")}</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {orders.map((o) => (
              <li key={o.id} className="rounded-3xl border border-border/60 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-bold">{o.order_number}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {new Date(o.created_at).toLocaleString(lang === "ar" ? "ar" : "en")}
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                    {t(statusLabels[o.status as OrderStatus] ?? "admin.new")}
                  </span>
                </div>
                <ul className="mt-4 space-y-1 text-sm">
                  {(o.order_items ?? []).map((it) => (
                    <li key={it.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {bilingual({ en: it.name_en, ar: it.name_ar || it.name_en }, lang)} ×{" "}
                        {it.qty}
                      </span>
                      <span>{formatSSP(it.line_total, lang)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">{t("cart.total")}</span>
                  <span className="font-semibold">{formatSSP(o.total, lang)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
