import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useCart } from "@/lib/cart";
import { useCatalog } from "@/lib/catalog";
import { useI18n, bilingual } from "@/lib/i18n";
import { formatSSP } from "@/lib/format";
import { placeOrder } from "@/lib/orders.functions";
import { listDeliveryAreas, type DeliveryArea } from "@/lib/admin.functions";
import { auth } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import { Truck, Store, Loader2, ChevronRight } from "lucide-react";
import { PickupLocationModal } from "@/components/PickupLocationModal";

export const Route = createFileRoute("/checkout")({
  component: Checkout,
  head: () => ({
    meta: [
      { title: "Checkout — BBM Household" },
      {
        name: "description",
        content: "Place your order with cash on delivery, M-Pesa or store pickup.",
      },
      { property: "og:title", content: "Checkout — BBM" },
      { property: "og:description", content: "Simple, guest checkout." },
    ],
  }),
});

type FulfillmentChoice = "pickup" | "delivery";

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";

const selectCls =
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 appearance-none";

function Checkout() {
  const { items, clear } = useCart();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { get } = useCatalog();
  const persistOrder = useServerFn(placeOrder);
  const fetchAreas = useServerFn(listDeliveryAreas);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  const rows = items.map((i) => ({ item: i, product: get(i.slug) })).filter((r) => r.product);
  const subtotal = rows.reduce((s, r) => s + r.product!.price * r.item.qty, 0);

  const { data: deliveryAreas = [], isLoading: areasLoading } = useQuery<DeliveryArea[]>({
    queryKey: ["checkout-delivery-areas"],
    queryFn: async () => {
      try {
        return (await fetchAreas({ data: { includeInactive: false } })) ?? [];
      } catch {
        return [];
      }
    },
  });

  const [fulfillment, setFulfillment] = useState<FulfillmentChoice | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  const selectedArea = useMemo(
    () => deliveryAreas.find((a) => a.id === selectedAreaId) ?? null,
    [deliveryAreas, selectedAreaId],
  );

  const deliveryFee = fulfillment === "pickup"
    ? 0
    : fulfillment === "delivery" && selectedArea
      ? selectedArea.fee
      : null;
  const total = deliveryFee !== null ? subtotal + deliveryFee : subtotal;

  const deliveryFeeDisplay = deliveryFee === null ? "—" : formatSSP(deliveryFee, lang);
  const deliveryChosen =
    fulfillment === "pickup" || (fulfillment === "delivery" && !!selectedArea);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    phone2: "",
    address: "",
    area_text: "",
    city: "Juba",
    notes: "",
  });
  const [err, setErr] = useState<string | null>(null);

  const update =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.phone) {
      setErr(t("form.required"));
      return;
    }
    if (!fulfillment) {
      setErr(
        lang === "ar"
          ? "يرجى اختيار طريقة الاستلام: الاستلام من المتجر أو التوصيل."
          : "Please choose Pickup or Delivery.",
      );
      return;
    }
    if (fulfillment === "delivery" && !selectedArea) {
      setErr(
        lang === "ar"
          ? "يرجى اختيار منطقة التوصيل."
          : "Please select a delivery area.",
      );
      return;
    }
    if (fulfillment === "delivery" && !form.address) {
      setErr(t("form.required"));
      return;
    }

    setErr(null);
    setSubmitting(true);

    try {
      const { data: sessionData } = await auth.getSession();
      const placedOrder = await persistOrder({
        data: {
          items: rows.map((r) => ({ slug: r.item.slug, qty: r.item.qty })),
          customerName: form.name,
          phone: form.phone,
          phone2: form.phone2 || undefined,
          address: fulfillment === "delivery" ? form.address || undefined : undefined,
          area: selectedArea
            ? selectedArea.name_ar || selectedArea.name_en
            : (form.area_text || undefined),
          city: form.city || undefined,
          notes: form.notes || undefined,
          payment: fulfillment === "pickup" ? "pickup" : "cod",
          delivery_area_id: selectedArea ? selectedArea.id : undefined,
          accessToken: sessionData.session?.access_token,
        },
      });

      const orderItems = rows.map((r) => {
        const itemPrice = r.product!.price;
        const lineTotal = itemPrice * r.item.qty;
        const productName = bilingual(r.product!.name, lang);

        return {
          name: productName,
          qty: r.item.qty,
          unitPrice: itemPrice,
          lineTotal: lineTotal,
          slug: r.item.slug,
        };
      });

      const pickupDeadlineAt =
        fulfillment === "pickup"
          ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
          : null;
      localStorage.setItem(
        "bbm.lastOrder",
        JSON.stringify({
          orderNumber: placedOrder.orderNumber,
          customerName: form.name,
          customerPhone: form.phone,
          subtotal: placedOrder.subtotal,
          deliveryFee: placedOrder.deliveryFee,
          total: placedOrder.total,
          payment: fulfillment === "pickup" ? "pickup" : "cod",
          deliveryAreaName: selectedArea
            ? selectedArea.name_ar || selectedArea.name_en
            : null,
          pickupDeadlineAt,
          pickupWindowDays: fulfillment === "pickup" ? 5 : null,
          form,
          items: orderItems,
        }),
      );

      setPlaced(true);
      clear();
      nav({ to: "/order-success", search: { n: placedOrder.orderNumber } as never });
    } catch (e: unknown) {
      const serverMessage = e instanceof Error ? e.message : null;
      setErr(
        serverMessage ||
          (lang === "ar"
            ? "تعذّر إرسال الطلب. حاول مرة أخرى."
            : "We couldn't send your order. Please try again."),
      );
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (rows.length === 0 && !placed) nav({ to: "/cart" });
  }, [rows.length, placed, nav]);
  if (rows.length === 0) return null;

  const isAr = lang === "ar";

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("checkout.title")}</h1>

        <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            {/* ---------- Contact ---------- */}
            <section className="rounded-3xl border border-border/60 bg-card p-6">
              <h2 className="text-lg font-semibold">{t("checkout.contact")}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={t("checkout.name")} required>
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={update("name")}
                    autoComplete="name"
                  />
                </Field>
                <Field label={t("checkout.phone")} required>
                  <input
                    className={inputCls}
                    value={form.phone}
                    onChange={update("phone")}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+211 …"
                  />
                </Field>
                <Field label={t("checkout.phone2")}>
                  <input
                    className={inputCls}
                    value={form.phone2}
                    onChange={update("phone2")}
                    inputMode="tel"
                  />
                </Field>
              </div>
            </section>

            {/* ---------- Fulfillment choice ---------- */}
            <section className="rounded-3xl border border-border/60 bg-card p-6">
              <h2 className="text-lg font-semibold">
                {isAr ? "طريقة الاستلام" : "Delivery or Pickup"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {isAr
                  ? "يتم حساب رسوم التوصيل بعد اختيار المنطقة."
                  : "Delivery fee updates after you choose an area."}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {/* Pickup card */}
                <label
                  className={`cursor-pointer rounded-2xl border-2 p-4 transition ${
                    fulfillment === "pickup"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    className="sr-only"
                    checked={fulfillment === "pickup"}
                    onChange={() => {
                      setFulfillment("pickup");
                      setSelectedAreaId("");
                    }}
                  />
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                        fulfillment === "pickup"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      }`}
                    >
                      <Store className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{t("checkout.pickup")}</div>
                      <div className="text-sm text-muted-foreground">
                        {isAr ? "التقط من المتجر — بدون رسوم" : "Free · Collect at store"}
                      </div>
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPickupModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          {isAr ? "عرض موقع الاستلام ←" : "View pickup location →"}
                        </button>
                      </div>
                    </div>
                  </div>
                </label>

                {/* Delivery card */}
                <label
                  className={`cursor-pointer rounded-2xl border-2 p-4 transition ${
                    fulfillment === "delivery"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    className="sr-only"
                    checked={fulfillment === "delivery"}
                    onChange={() => setFulfillment("delivery")}
                  />
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                        fulfillment === "delivery"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      }`}
                    >
                      <Truck className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{t("checkout.cod")}</div>
                      <div className="text-sm text-muted-foreground">
                        {isAr ? "ادفع عند وصول الطلب" : "Pay when your order arrives"}
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Delivery area selector */}
              {fulfillment === "delivery" && (
                <div className="mt-5 rounded-2xl border border-border/60 bg-secondary/30 p-4">
                  <div className="mb-2 text-sm font-semibold">
                    {isAr ? "اختر منطقة التوصيل" : "Select delivery area"}
                  </div>
                  {areasLoading ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isAr ? "جارٍ تحميل مناطق التوصيل…" : "Loading delivery areas…"}
                    </div>
                  ) : deliveryAreas.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      {isAr
                        ? "لا توجد مناطق توصيل متاحة حاليًا."
                        : "No delivery areas available right now."}
                    </div>
                  ) : (
                    <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                      {deliveryAreas.map((a) => {
                        const active = a.id === selectedAreaId;
                        const name = isAr ? a.name_ar || a.name_en : a.name_en;
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAreaId(a.id);
                                setForm((f) => ({ ...f, area_text: name }));
                              }}
                              className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                                active
                                  ? "border-primary bg-primary/5 font-semibold text-foreground"
                                  : "border-border bg-background hover:border-primary/40"
                              }`}
                            >
                              <span>{name}</span>
                              <span className="flex items-center gap-1 tabular-nums">
                                {formatSSP(a.fee, lang)}
                                {active && <ChevronRight className="h-4 w-4 text-primary" />}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* ---------- Delivery details (address) ---------- */}
            {fulfillment === "delivery" && (
              <section className="rounded-3xl border border-border/60 bg-card p-6">
                <h2 className="text-lg font-semibold">{t("checkout.delivery")}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label={t("checkout.address")} required>
                    <input className={inputCls} value={form.address} onChange={update("address")} />
                  </Field>
                  <Field label={t("checkout.city")}>
                    <input className={inputCls} value={form.city} onChange={update("city")} />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label={t("checkout.notes")}>
                    <textarea
                      className={inputCls}
                      rows={3}
                      value={form.notes}
                      onChange={update("notes")}
                    />
                  </Field>
                </div>
              </section>
            )}

            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>

          {/* ---------- Order summary sidebar ---------- */}
          <aside className="h-fit rounded-3xl border border-border/60 bg-card p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold">{t("checkout.summary")}</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {rows.map(({ item, product }) => (
                <li key={item.slug} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {bilingual(product!.name, lang)} × {item.qty}
                  </span>
                  <span className="shrink-0">{formatSSP(product!.price * item.qty, lang)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt>{t("cart.subtotal")}</dt>
                <dd>{formatSSP(subtotal, lang)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("cart.delivery")}</dt>
                <dd
                  className={
                    deliveryFee === null
                      ? "text-muted-foreground"
                      : deliveryFee === 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : ""
                  }
                >
                  {deliveryFee === 0
                    ? `${formatSSP(0, lang)} · ${isAr ? "استلام" : "Pickup"}`
                    : deliveryFeeDisplay}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-between border-t border-border pt-4">
              <span className="text-base font-semibold">{t("cart.total")}</span>
              <span className="font-display text-xl font-bold">{formatSSP(total, lang)}</span>
            </div>

            {!deliveryChosen && (
              <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {fulfillment === "delivery"
                  ? isAr
                    ? "اختر منطقة التوصيل لتحديث الإجمالي."
                    : "Pick a delivery area to finalize the total."
                  : isAr
                    ? "اختر طريقة الاستلام: التوصيل أو الاستلام من المتجر."
                    : "Choose Pickup or Delivery to continue."}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !deliveryChosen}
              className="btn-tap mt-6 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              {submitting
                ? isAr
                  ? "جارٍ الإرسال…"
                  : "Sending…"
                : t("checkout.place")}
            </button>
          </aside>
        </form>
      </section>
      <PickupLocationModal open={pickupModalOpen} onClose={() => setPickupModalOpen(false)} />
    </Layout>
  );
}
