import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrders, updateOrderStatus, type OrderStatus } from "@/lib/orders.functions";
import { auth } from "@/lib/auth";
import { formatSSP } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: OrdersAdmin,
});

const STATUSES: OrderStatus[] = ["new", "confirmed", "out_for_delivery", "delivered", "cancelled"];

const statusLabels: Record<OrderStatus, string> = {
  new: "admin.new",
  confirmed: "admin.confirmed",
  out_for_delivery: "admin.out_for_delivery",
  delivered: "admin.delivered",
  cancelled: "admin.cancelled",
};

const tone: Record<string, string> = {
  new: "bg-accent text-accent-foreground",
  confirmed: "bg-primary/15 text-primary",
  out_for_delivery: "bg-amber-500/15 text-amber-700",
  delivered: "bg-emerald-500/15 text-emerald-700",
  cancelled: "bg-destructive/15 text-destructive",
};

function OrdersAdmin() {
  const { t, lang } = useI18n();
  const fetchOrders = useServerFn(listOrders);
  const setStatus = useServerFn(updateOrderStatus);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      return await fetchOrders({ data: { accessToken: token } });
    },
  });

  const mut = useMutation({
    mutationFn: async (v: { id: string; status: OrderStatus }) => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      return await setStatus({ data: { ...v, accessToken: token } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  if (isLoading)
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" />;
  if (error)
    return <p className="text-sm text-destructive">Could not load orders: {error.message}</p>;

  const orders = data ?? [];
  const revenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{t("admin.orderstitle")}</h1>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("admin.orderstitle")} value={String(orders.length)} />
        <Stat label={t("admin.new")} value={String(orders.filter((o) => o.status === "new").length)} />
        <Stat
          label={t("admin.delivered")}
          value={String(orders.filter((o) => o.status === "delivered").length)}
        />
        <Stat label="Revenue" value={formatSSP(revenue, lang)} />
      </div>

      {orders.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No orders yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-3xl border border-border/60 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold">{o.order_number}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone[o.status] ?? "bg-secondary"}`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()} ·{" "}
                    {(o.payment_method || "COD").toUpperCase()}
                  </div>
                </div>
                <div className="font-display text-xl font-bold">{formatSSP(o.total, "en")}</div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="text-sm">
                  <div className="font-semibold">{o.customer_name}</div>
                  <div className="text-muted-foreground">
                    {o.phone}
                    {o.phone2 ? ` · ${o.phone2}` : ""}
                  </div>
                  <div className="text-muted-foreground">
                    {[o.address, o.area, o.city].filter(Boolean).join(", ") || "Store pickup"}
                  </div>
                  {o.notes && <div className="mt-1 text-muted-foreground">“{o.notes}”</div>}
                  {o.mpesa_txid && (
                    <div className="mt-1 text-muted-foreground">M-Pesa: {o.mpesa_txid}</div>
                  )}
                </div>
                <ul className="space-y-1 text-sm">
                  {(o.order_items ?? []).map((it) => (
                    <li key={it.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {it.name_en} × {it.qty}
                      </span>
                      <span>{formatSSP(it.line_total, "en")}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 border-t border-border pt-1 text-muted-foreground">
                    <span>Delivery</span>
                    <span>{formatSSP(o.delivery_fee, "en")}</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => mut.mutate({ id: o.id, status: s })}
                    disabled={mut.isPending || o.status === s}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      o.status === s
                        ? "bg-foreground text-background"
                        : "bg-secondary hover:bg-secondary/70"
                    }`}
                  >
                    {t(statusLabels[s])}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}
