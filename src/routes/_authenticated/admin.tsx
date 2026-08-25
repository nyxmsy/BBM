import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess, claimFirstAdmin } from "@/lib/admin.functions";
import { auth } from "@/lib/auth";
import { BbmLogo } from "@/components/BbmLogo";
import { LogOut, Package, ShoppingBag, Loader2 } from "lucide-react";
import { useState } from "react";

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

  const [claimErrorMsg, setClaimErrorMsg] = useState<string | null>(null);

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
          <h1 className="text-xl font-bold">No dashboard access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is signed in but has no staff role yet. If you are the store owner setting
            up for the first time, claim admin access below.
          </p>

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
            <p className="mt-3 text-sm text-destructive">
              An admin already exists. Ask them to add your account.
            </p>
          )}

          <button
            type="button"
            onClick={signOut}
            className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/">
            <BbmLogo />
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/admin"
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-foreground text-background" }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <ShoppingBag className="h-4 w-4" /> Orders
            </Link>
            <Link
              to="/admin/products"
              activeProps={{ className: "bg-foreground text-background" }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <Package className="h-4 w-4" /> Products
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="ms-2 grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
