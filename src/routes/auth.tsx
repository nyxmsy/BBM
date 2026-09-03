import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth } from "@/lib/auth";
import { BbmLogo } from "@/components/BbmLogo";
import { Loader2 } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Staff Sign In — BBM Household" },
      {
        name: "description",
        content: "Sign in to the BBM staff dashboard to manage products and customer orders.",
      },
      { property: "og:title", content: "Staff Sign In — BBM Household" },
      { property: "og:description", content: "BBM staff dashboard access." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const input =
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";

function AuthPage() {
  const nav = useNavigate();
  const { lang, setLang, t, dir } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const roles = await auth.getMyRoles();
      nav({ to: roles.isStaff ? "/admin" : "/account" });
    });
  }, [nav]);

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
        nav({ to: roles.isStaff ? "/admin" : "/account" });
      } else {
        const { error } = await auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setMsg(t("staff.success"));
        setMode("signin");
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-7 shadow-sm">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex">
            <BbmLogo />
          </Link>
          <div className="inline-flex items-center rounded-full border border-border/80 bg-card/80 p-0.5">
            {langBtn("en", "EN")}
            {langBtn("ar", "ع")}
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold">
          {mode === "signin" ? t("staff.title") : t("staff.create")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("staff.subtitle")}</p>

        <form onSubmit={submit} className="mt-6 space-y-3" dir={dir}>
          {mode === "signup" && (
            <input
              className={input}
              placeholder={t("staff.name")}
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
              t("staff.signin")
            ) : (
              t("staff.signup")
            )}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setErr(null);
          }}
          className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? t("staff.noaccount") : t("staff.haveaccount")}
        </button>
      </div>
    </main>
  );
}
