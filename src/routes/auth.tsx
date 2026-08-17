import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth } from "@/lib/auth";
import { BbmLogo } from "@/components/BbmLogo";
import { Loader2 } from "lucide-react";

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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/admin" });
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
        nav({ to: "/admin" });
      } else {
        const { error } = await auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setMsg("Account created successfully. You can now sign in.");
        setMode("signin");
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const continueWithDemo = async () => {
    setErr(null);
    setBusy(true);
    try {
      await auth.signInWithPassword({ email: "admin@bbm.store", password: "password123" });
      nav({ to: "/admin" });
    } catch {
      setErr("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-7 shadow-sm">
        <Link to="/" className="mb-6 inline-flex">
          <BbmLogo />
        </Link>
        <h1 className="text-2xl font-bold">
          {mode === "signin" ? "Staff sign in" : "Create staff account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage products and customer orders.</p>

        <button
          type="button"
          onClick={continueWithDemo}
          disabled={busy}
          className="btn-tap mt-6 w-full rounded-full border border-border bg-background py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
        >
          Quick Staff Access (Demo)
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or with email{" "}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              className={input}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className={input}
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className={input}
            type="password"
            required
            minLength={6}
            placeholder="Password"
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
              "Sign in"
            ) : (
              "Create account"
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
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
