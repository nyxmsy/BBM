import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ADMIN_ORDER_STATUSES,
  listOrders,
  updateOrderStatus,
  type AdminOrderStatus,
  type AdminOrderFilter,
  type Order,
} from "@/lib/orders.functions";
import { auth } from "@/lib/auth";
import { formatSSP } from "@/lib/format";
import {
  Loader2,
  AlertTriangle,
  Clock,
  Store,
  Truck,
  History,
  ChevronDown,
  ChevronUp,
  XCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { bilingual, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: OrdersAdmin,
});

const statusLabels: Record<string, string> = {
  new: "admin.processing",
  processing: "admin.processing",
  completed: "admin.completed",
  picked_up: "admin.picked_up",
  delivered: "admin.delivered",
  cancelled: "admin.cancelled",
  confirmed: "admin.processing",
  out_for_delivery: "admin.delivered",
};

const tone: Record<string, string> = {
  new: "bg-primary/15 text-primary",
  processing: "bg-primary/15 text-primary",
  confirmed: "bg-primary/15 text-primary",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  picked_up: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  out_for_delivery: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  delivered: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  cancelled: "bg-destructive/15 text-destructive",
};

function getPickupRemaining(
  deadline: string | null | undefined,
  isAr: boolean,
): { text: string; urgent: boolean; expired: boolean } | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) {
    return {
      text: isAr ? "انتهت فترة الاستلام" : "Pickup deadline expired",
      urgent: true,
      expired: true,
    };
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 1) {
    return {
      text: isAr
        ? `الموعد النهائي: متبقي ${days} يوم`
        : `Pickup deadline: ${days} day${days > 1 ? "s" : ""} remaining`,
      urgent: false,
      expired: false,
    };
  }
  return {
    text: isAr
      ? `الموعد النهائي: متبقي ${hours} ساعة`
      : `Pickup deadline: ${hours} hour${hours > 1 ? "s" : ""} remaining`,
    urgent: true,
    expired: false,
  };
}

type PendingStatusChange = {
  order: Order;
  status: AdminOrderStatus;
} | null;

function OrdersAdmin() {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const fetchOrders = useServerFn(listOrders);
  const setStatus = useServerFn(updateOrderStatus);
  const qc = useQueryClient();

  const [selectedFilter, setSelectedFilter] = useState<AdminOrderFilter>("all");
  const [confirmCancelOrder, setConfirmCancelOrder] = useState<Order | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingStatusChange>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      return await fetchOrders({ data: { accessToken: token } });
    },
  });

  const statusAr: Record<AdminOrderStatus, string> = {
    processing: t("admin.processing"),
    picked_up: t("admin.picked_up"),
    delivered: t("admin.delivered"),
    completed: t("admin.completed"),
    cancelled: t("admin.cancelled"),
  };

  function statusChangeExplanation(
    order: Order,
    nextStatus: AdminOrderStatus,
  ): string {
    const n = order.order_number;
    const cur = statusAr[order.status as AdminOrderStatus] ?? order.status;
    const nx = statusAr[nextStatus];
    if (nextStatus === "cancelled") {
      return isAr
        ? `سيتم إلغاء الطلب #${n} و استرجاع الكمية إلى المخزون. لا يمكن التراجع عن هذا الإجراء.`
        : `Order #${n} will be cancelled and reserved inventory will be restored. This cannot be undone.`;
    }
    if (nextStatus === "completed") {
      return isAr
        ? `سيتم وضع علامة على الطلب #${n} كمكتمل — أي أنها مُدفعة ومُتاحة. لا يمكن التراجع عادةً.`
        : `Mark order #${n} as Completed — the transaction is finalized. Usually cannot be reverted.`;
    }
    if (nextStatus === "processing" && (order.status === "picked_up" || order.status === "delivered" || order.status === "completed")) {
      return isAr
        ? `سيتم إعادة الطلب #${n} من "${cur}" إلى "${nx}" كتصحيح. هل تريد المتابعة؟`
        : `Roll order #${n} back from "${cur}" to "${nx}" as a correction. Continue?`;
    }
    if (nextStatus === "delivered" && order.payment_method === "pickup") {
      return isAr
        ? `تحذير: هذا الطلب استلام من المتجر (${order.order_number}). تأكيد التوصيل؟`
        : `Warning: this is a pickup order (#${order.order_number}). Mark as delivered?`;
    }
    return isAr
      ? `تغيير حالة الطلب #${n} من "${cur}" إلى "${nx}"؟`
      : `Change order #${n} status from "${cur}" to "${nx}"?`;
  }

  const mut = useMutation({
    mutationFn: async (v: { id: string; status: AdminOrderStatus }) => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      return await setStatus({ data: { ...v, accessToken: token } });
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setToast({
        type: "success",
        text: isAr
          ? `تم تغيير الحالة إلى "${statusAr[vars.status]}" بنجاح.`
          : `Status changed to "${statusAr[vars.status]}".`,
      });
    },
    onError: (e: unknown, vars) => {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setToast({
        type: "error",
        text: isAr
          ? `فشل تغيير الحالة: ${msg}`
          : `Failed to set status to "${statusAr[vars.status]}": ${msg}`,
      });
    },
  });

  const handleStatusChange = (order: Order, nextStatus: AdminOrderStatus) => {
    if (nextStatus === "cancelled") {
      setConfirmCancelOrder(order);
    } else {
      setPendingChange({ order, status: nextStatus });
    }
  };

  const toggleHistory = (orderId: string) => {
    setExpandedHistory((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  if (isLoading)
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" />;
  if (error)
    return (
      <p className="text-sm text-destructive">
        {t("admin.ordersloaderror")}: {error.message}
      </p>
    );

  const orders = data ?? [];

  // Filter tab counts
  const filters: { key: AdminOrderFilter; label: string; count: number }[] = [
    { key: "all", label: isAr ? "الكل" : "All", count: orders.length },
    {
      key: "processing",
      label: t("admin.processing"),
      count: orders.filter(
        (o) => o.status === "processing" || o.status === "new" || o.status === "confirmed",
      ).length,
    },
    {
      key: "picked_up",
      label: t("admin.picked_up"),
      count: orders.filter((o) => o.status === "picked_up").length,
    },
    {
      key: "delivered",
      label: t("admin.delivered"),
      count: orders.filter((o) => o.status === "delivered" || o.status === "out_for_delivery")
        .length,
    },
    {
      key: "completed",
      label: t("admin.completed"),
      count: orders.filter((o) => o.status === "completed").length,
    },
    {
      key: "cancelled",
      label: t("admin.cancelled"),
      count: orders.filter((o) => o.status === "cancelled").length,
    },
  ];

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "processing")
      return o.status === "processing" || o.status === "new" || o.status === "confirmed";
    if (selectedFilter === "delivered")
      return o.status === "delivered" || o.status === "out_for_delivery";
    return o.status === selectedFilter;
  });

  const revenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);

  // Auto-cancelled overdue pickup alerts
  const expiredPickupOrders = orders.filter(
    (o) => o.status === "cancelled" && o.auto_cancel_reason,
  );

  return (
    <div className="space-y-6">
      {/* Header & Revenue Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("admin.orderstitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAr
              ? "إدارة ومعالجة طلبات العملاء"
              : "Manage customer orders & fulfillment lifecycle"}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card px-4 py-2.5 shadow-xs">
          <span className="text-xs text-muted-foreground">{t("admin.revenue")}</span>
          <div className="font-display text-lg font-bold text-primary">
            {formatSSP(revenue, lang)}
          </div>
        </div>
      </div>

      {/* Overdue Pickup Alert Banner */}
      {expiredPickupOrders.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 text-sm">
              <div className="font-bold">
                {isAr ? "⚠️ تنبيه: طلبات استلام ملغاة تلقائيًا" : "⚠️ Pickup order(s) expired"}
              </div>
              <p className="mt-1 leading-relaxed">
                {isAr
                  ? `الطلب #${expiredPickupOrders[0].order_number} تم إلغاؤه تلقائيًا لعدم الاستلام خلال فترة الاستلام المحددة وتم استرجاع المخزون تلقائيًا. الإجراء: تذكير العميل بإمكانية تقديم طلب جديد أو زيارة المتجر مباشرة.`
                  : `Order #${expiredPickupOrders[0].order_number} was automatically cancelled because it was not collected within the pickup window. Action: Remind the customer that they can place a new order or visit the store directly.`}
              </p>
              <button
                type="button"
                onClick={() => setSelectedFilter("cancelled")}
                className="mt-2 text-xs font-semibold underline hover:no-underline"
              >
                {isAr ? "عرض الطلبات الملغاة" : "View Cancelled Orders"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setSelectedFilter(f.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
              selectedFilter === f.key
                ? "bg-foreground text-background shadow-xs"
                : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                selectedFilter === f.key
                  ? "bg-background/20 text-background"
                  : "bg-foreground/10 text-foreground"
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
          <p>{t("admin.noorders")}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filteredOrders.map((o) => {
            const isPickup = o.payment_method === "pickup";
            const pickupInfo =
              isPickup && o.status !== "cancelled" && o.status !== "completed"
                ? getPickupRemaining(o.pickup_deadline_at, isAr)
                : null;
            const history = o.status_history ?? [];
            const isHistOpen = Boolean(expandedHistory[o.id]);

            return (
              <li
                key={o.id}
                className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-xs transition"
              >
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold">{o.order_number}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[o.status] ?? "bg-secondary"}`}
                      >
                        {t(statusLabels[o.status] ?? "admin.processing")}
                      </span>

                      {/* Payment / Fulfillment Pill */}
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {isPickup ? (
                          <>
                            <Store className="h-3 w-3 text-primary" /> {t("checkout.pickup")}
                          </>
                        ) : (
                          <>
                            <Truck className="h-3 w-3 text-primary" /> {t("checkout.cod")}
                          </>
                        )}
                      </span>

                      {/* Pickup Deadline Badge */}
                      {pickupInfo && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            pickupInfo.urgent
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {pickupInfo.text}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString(isAr ? "ar" : "en")}
                    </div>
                  </div>

                  <div className="text-end">
                    <div className="font-display text-xl font-bold text-foreground">
                      {formatSSP(o.total, lang)}
                    </div>
                  </div>
                </div>

                {/* Auto-cancel Reason Message */}
                {o.auto_cancel_reason && (
                  <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2 text-xs text-destructive">
                    {o.auto_cancel_reason}
                  </div>
                )}

                {/* Customer & Items Details */}
                <div className="mt-4 grid gap-4 border-t border-border/50 pt-4 sm:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold text-foreground">{o.customer_name}</div>
                    <div className="text-muted-foreground">
                      <a href={`tel:${o.phone}`} className="hover:underline">
                        {o.phone}
                      </a>
                      {o.phone2 ? ` · ${o.phone2}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isPickup
                        ? isAr
                          ? "استلام من المتجر (Munuki Block B)"
                          : "Store Pickup (Munuki Block B)"
                        : [o.address, o.area, o.city].filter(Boolean).join(", ")}
                    </div>
                    {o.notes && (
                      <div className="mt-2 rounded-xl bg-secondary/60 p-2.5 text-xs italic text-muted-foreground">
                        “{o.notes}”
                      </div>
                    )}
                  </div>

                  {/* Itemized summary */}
                  <ul className="space-y-1.5 text-sm">
                    {(o.order_items ?? []).map((it) => (
                      <li key={it.id} className="flex justify-between gap-3 text-xs sm:text-sm">
                        <span className="min-w-0 truncate">
                          {bilingual({ en: it.name_en, ar: it.name_ar || it.name_en }, lang)} ×{" "}
                          {it.qty}
                        </span>
                        <span className="shrink-0 font-medium">
                          {formatSSP(it.line_total, lang)}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-3 border-t border-border/50 pt-1.5 text-xs text-muted-foreground">
                      <span>{t("cart.subtotal")}</span>
                      <span>{formatSSP(o.subtotal, lang)}</span>
                    </li>
                    <li className="flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>{t("cart.delivery")}</span>
                      <span>{formatSSP(o.delivery_fee, lang)}</span>
                    </li>
                  </ul>
                </div>

                {/* Status Lifecycle Action Buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="me-1 text-xs font-medium text-muted-foreground">
                      {isAr ? "تغيير الحالة:" : "Change status:"}
                    </span>

                    {/* Contextual Flow */}
                    {ADMIN_ORDER_STATUSES.map((s) => {
                      const isActive =
                        o.status === s ||
                        (s === "processing" && (o.status === "new" || o.status === "confirmed")) ||
                        (s === "delivered" && o.status === "out_for_delivery");

                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={mut.isPending || isActive}
                          onClick={() => handleStatusChange(o, s)}
                          className={`btn-tap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            isActive
                              ? "bg-foreground text-background shadow-xs"
                              : s === "cancelled"
                                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                          }`}
                        >
                          {t(statusLabels[s])}
                        </button>
                      );
                    })}
                  </div>

                  {/* Status History Toggle */}
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleHistory(o.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <History className="h-3.5 w-3.5" />
                      <span>{isAr ? "السجل" : "History"}</span>
                      {isHistOpen ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* History Timeline View */}
                {isHistOpen && history.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-secondary/40 p-3 text-xs space-y-2 animate-in fade-in duration-150">
                    <div className="font-semibold text-muted-foreground">
                      {isAr ? "سجل تغييرات الحالة" : "Status Change History"}
                    </div>
                    <ul className="space-y-1.5 divide-y divide-border/40">
                      {history.map((h) => (
                        <li key={h.id} className="pt-1.5 first:pt-0 flex justify-between gap-2">
                          <div>
                            <span className="font-medium text-foreground">
                              {h.old_status ? `${h.old_status} → ` : ""}
                              {h.new_status}
                            </span>
                            {h.reason && (
                              <span className="ms-2 text-muted-foreground">({h.reason})</span>
                            )}
                          </div>
                          <span className="shrink-0 text-muted-foreground">
                            {new Date(h.created_at).toLocaleTimeString(isAr ? "ar" : "en", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Safeguard Cancellation Modal */}
      {confirmCancelOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold">
                {isAr ? "تأكيد إلغاء الطلب" : "Cancel this order?"}
              </h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {isAr
                ? `هل أنت متأكد من إلغاء الطلب #${confirmCancelOrder.order_number}؟ سيتم إلغاء الطلب واسترجاع المنتجات للمخزون تلقائيًا.`
                : `Change order #${confirmCancelOrder.order_number} to Cancelled? This will restore the reserved inventory.`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancelOrder(null)}
                className="btn-tap rounded-full border border-border px-5 py-2 text-sm font-semibold hover:bg-secondary"
              >
                {isAr ? "تراجع" : "Keep Order"}
              </button>
              <button
                type="button"
                disabled={mut.isPending}
                onClick={() => {
                  mut.mutate({ id: confirmCancelOrder.id, status: "cancelled" });
                  setConfirmCancelOrder(null);
                }}
                className="btn-tap inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isAr ? "تأكيد الإلغاء" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status-change confirmation (non-cancel) */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-bold">
              {isAr
                ? `تغيير الحالة إلى "${statusAr[pendingChange.status]}"؟`
                : `Change status to "${statusAr[pendingChange.status]}"?`}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {statusChangeExplanation(pendingChange.order, pendingChange.status)}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingChange(null)}
                className="btn-tap rounded-full border border-border px-5 py-2 text-sm font-semibold hover:bg-secondary"
              >
                {isAr ? "تراجع" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={mut.isPending}
                onClick={() => {
                  mut.mutate({
                    id: pendingChange.order.id,
                    status: pendingChange.status,
                  });
                  setPendingChange(null);
                }}
                className="btn-tap inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isAr ? "تأكيد التغيير" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div
            className={`pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl ${
              toast.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="flex-1 leading-relaxed">{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
