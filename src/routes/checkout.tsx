import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useCart } from "@/lib/cart";
import { useCatalog } from "@/lib/catalog";
import { placeOrder } from "@/lib/orders.functions";
import { useServerFn } from "@tanstack/react-start";
import { useI18n, bilingual } from "@/lib/i18n";
import { formatSSP } from "@/lib/format";
import { STORE } from "@/lib/store";
import { useEffect, useState } from "react";
import { Truck, Wallet, Store } from "lucide-react";

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

type Payment = "cod" | "pickup";

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

function Checkout() {
  const { items, clear } = useCart();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { get } = useCatalog();
  const submitOrder = useServerFn(placeOrder);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);

  const rows = items.map((i) => ({ item: i, product: get(i.slug) })).filter((r) => r.product);
  const subtotal = rows.reduce((s, r) => s + r.product!.price * r.item.qty, 0);

  const [payment, setPayment] = useState<Payment>("cod");
  const delivery = payment === "pickup" ? 0 : rows.length > 0 ? STORE.deliveryFeeJuba : 0;
  const total = subtotal + delivery;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    phone2: "",
    address: "",
    area: "",
    city: "Juba",
    notes: "",
  });
  const [err, setErr] = useState<string | null>(null);

  const update =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || (payment !== "pickup" && (!form.address || !form.area))) {
      setErr(t("form.required"));
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const res = await submitOrder({
        data: {
          items: rows.map((r) => ({ slug: r.item.slug, qty: r.item.qty })),
          customerName: form.name,
          phone: form.phone,
          phone2: form.phone2 || undefined,
          address: form.address || undefined,
          area: form.area || undefined,
          city: form.city || undefined,
          notes: form.notes || undefined,
          payment,
        },
      });
      try {
        localStorage.setItem(
          "bbm.lastOrder",
          JSON.stringify({ 
            orderNumber: res.orderNumber, 
            total: res.total, 
            payment, 
            form,
            items: rows.map(r => ({
              slug: r.item.slug,
              qty: r.item.qty,
              name: lang === "ar" ? r.product?.name_ar : r.product?.name_en
            }))
          }),
        );
      } catch (e) {
        void e;
      }
      setPlaced(true);
      clear();
      nav({ to: "/order-success", search: { n: res.orderNumber } as never });
    } catch {
      setErr(
        lang === "ar"
          ? "تعذّر إرسال الطلب. حاول مرة أخرى."
          : "We couldn't send your order. Please try again.",
      );
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (rows.length === 0 && !placed) nav({ to: "/cart" });
  }, [rows.length, placed, nav]);
  if (rows.length === 0) return null;

  const payOptions: {
    id: Payment;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    warning?: string;
  }[] = [
    {
      id: "cod",
      label: t("checkout.cod"),
      desc: lang === "ar" ? "ادفع نقدًا عند وصول الطلب." : "Pay when your order arrives.",
      icon: Truck,
    },
    {
      id: "pickup",
      label: t("checkout.pickup"),
      desc: lang === "ar" ? STORE.address.ar : STORE.address.en,
      icon: Store,
      warning: t("checkout.pickup_warning"),
    },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("checkout.title")}</h1>

        <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
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

            {payment !== "pickup" && (
              <section className="rounded-3xl border border-border/60 bg-card p-6">
                <h2 className="text-lg font-semibold">{t("checkout.delivery")}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label={t("checkout.address")} required>
                    <input className={inputCls} value={form.address} onChange={update("address")} />
                  </Field>
                  <Field label={t("checkout.area")} required>
                    <input className={inputCls} value={form.area} onChange={update("area")} />
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

            <section className="rounded-3xl border border-border/60 bg-card p-6">
              <h2 className="text-lg font-semibold">{t("checkout.payment")}</h2>
              <div className="mt-4 grid gap-3">
                {payOptions.map((o) => (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-start gap-4 rounded-2xl border-2 p-4 transition ${
                      payment === o.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pay"
                      className="sr-only"
                      checked={payment === o.id}
                      onChange={() => setPayment(o.id)}
                    />
                    <div
                      className={`grid h-11 w-11 place-items-center rounded-xl ${payment === o.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                    >
                      <o.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{o.label}</div>
                      <div className="text-sm text-muted-foreground">{o.desc}</div>
                      {o.warning && (
                        <div className="mt-2 text-xs text-amber-600">{o.warning}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>

          <aside className="h-fit rounded-3xl border border-border/60 bg-card p-6">
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
                <dd>{formatSSP(delivery, lang)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-between border-t border-border pt-4">
              <span className="text-base font-semibold">{t("cart.total")}</span>
              <span className="font-display text-xl font-bold">{formatSSP(total, lang)}</span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-tap mt-6 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              {submitting ? (lang === "ar" ? "جارٍ الإرسال…" : "Sending…") : t("checkout.place")}
            </button>
          </aside>
        </form>
      </section>
    </Layout>
  );
}
