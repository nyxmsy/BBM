import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, MessageCircle, RotateCcw, Store, MapPin, Clock } from "lucide-react";
import { STORE } from "@/lib/store";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { PickupLocationModal } from "@/components/PickupLocationModal";
import { generateBusinessWhatsAppMessage, generateBusinessWhatsAppUrl } from "@/lib/whatsapp";
import {
  getOrderStatus,
  markOrderConfirmedSent,
  markOrderWhatsappOpened,
  type OrderWhatsappStatus,
} from "@/lib/order-status";

export const Route = createFileRoute("/order-success")({
  validateSearch: z.object({ n: z.string().optional() }),
  component: Success,
  head: () => ({
    meta: [
      { title: "Order Received — BBM" },
      { name: "description", content: "Thank you for your order." },
    ],
  }),
});

function Success() {
  const { n } = Route.useSearch();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [locModalOpen, setLocModalOpen] = useState(false);

  // Live state reflecting the user's current order-status
  const [status, setStatus] = useState<OrderWhatsappStatus>("unsent");

  useEffect(() => {
    setStatus(getOrderStatus(n));
  }, [n]);

  useEffect(() => {
    if (!n) return;
    const recompute = () => setStatus(getOrderStatus(n));
    recompute();
    const id = window.setInterval(recompute, 60 * 1000);
    return () => window.clearInterval(id);
  }, [n]);

  type StoredOrder = {
    orderNumber?: string;
    customerName?: string;
    customerPhone?: string;
    items?: Array<{
      name: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
      slug?: string;
    }>;
    subtotal?: number;
    deliveryFee?: number;
    total?: number;
    payment?: string;
    pickupDeadlineAt?: string | null;
    pickupWindowDays?: number | null;
    form?: {
      name?: string;
      phone?: string;
      payment?: string;
      address?: string;
      area?: string;
      city?: string;
      notes?: string;
    };
  };

  let orderDetails: StoredOrder | null = null;
  try {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("bbm.lastOrder") : null;
    if (stored) orderDetails = JSON.parse(stored) as StoredOrder;
  } catch {
    /* ignore */
  }

  const isPickup = orderDetails?.payment === "pickup" || orderDetails?.form?.payment === "pickup";

  function computeRemaining(deadlineIso?: string | null): string | null {
    if (!deadlineIso) return null;
    const ms = new Date(deadlineIso).getTime() - Date.now();
    if (ms <= 0) return isAr ? "انتهت فترة الاستلام" : "Pickup period expired";
    const totalHours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0) {
      if (hours > 0) {
        return isAr
          ? `فترة الاستلام: ${days} يوم و${hours} ساعة متبقية`
          : `Pickup deadline: ${days}d ${hours}h remaining`;
      }
      return isAr
        ? `فترة الاستلام: ${days} ${days === 1 ? "يوم" : "أيام"} متبقية`
        : `Pickup deadline: ${days} ${days === 1 ? "day" : "days"} remaining`;
    }
    if (hours > 0) {
      return isAr
        ? `فترة الاستلام: ${hours} ساعات متبقية`
        : `Pickup deadline: ${hours} ${hours === 1 ? "hour" : "hours"} remaining`;
    }
    const mins = Math.max(1, Math.floor(ms / (1000 * 60)));
    return isAr
      ? `فترة الاستلام: ${mins} دقائق متبقية`
      : `Pickup deadline: ${mins} ${mins === 1 ? "minute" : "minutes"} remaining`;
  }

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isPickup) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => window.clearInterval(id);
  }, [isPickup]);
  const remainingLabel = computeRemaining(orderDetails?.pickupDeadlineAt);

  let waUrl = `https://wa.me/${STORE.whatsapp.replace(/\D/g, "")}`;
  if (orderDetails) {
    const formattedMessage = generateBusinessWhatsAppMessage(
      {
        orderNumber: n || orderDetails.orderNumber || "",
        customerName: orderDetails.customerName || orderDetails.form?.name || "",
        customerPhone: orderDetails.customerPhone || orderDetails.form?.phone || "",
        items: orderDetails.items || [],
        subtotal: orderDetails.subtotal || 0,
        deliveryFee: orderDetails.deliveryFee || 0,
        total: orderDetails.total || 0,
        paymentMethod: (orderDetails.payment as "cod" | "pickup") || "cod",
        address: orderDetails.form?.address,
        area: orderDetails.form?.area,
        city: orderDetails.form?.city,
        notes: orderDetails.form?.notes,
      },
      lang,
    );
    waUrl = generateBusinessWhatsAppUrl(STORE.whatsapp, formattedMessage);
  }

  const onSendClick = () => markOrderWhatsappOpened(n);
  const onConfirmSent = () => markOrderConfirmedSent(n);

  const orderRef = (
    <div className="space-y-3">
      {n && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {isAr ? "رقم مرجع الطلب" : "Order Reference"}
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-primary">{n}</div>
        </div>
      )}

      {isPickup && (
        <div className="rounded-2xl border border-border/60 bg-primary/5 p-4 text-start">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Store className="h-4 w-4" />
              <span>{isAr ? "الاستلام من المتجر" : "Store Pickup Order"}</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Clock className="h-3 w-3" />
              {remainingLabel ??
                (isAr ? "فترة الاستلام: 5 أيام" : "Pickup deadline: 5 days remaining")}
            </span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            <MapPin className="inline h-3.5 w-3.5 me-1 text-primary" />
            {isAr ? STORE.address.ar : STORE.address.en}
          </p>

          <button
            type="button"
            onClick={() => setLocModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {isAr ? "عرض تفاصيل موقع المتجر ←" : "View store location →"}
          </button>
        </div>
      )}
    </div>
  );

  // -------------------------------- STATE 1️⃣: UNSENT — user has not clicked WhatsApp yet.
  if (status === "unsent") {
    return (
      <Layout>
        <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">
            {isAr ? "خطوة واحدة أخيرة لتأكيد طلبك!" : "One Last Step to Confirm Your Order!"}
          </h1>

          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            {isAr
              ? `تم حفظ تفاصيل طلبك رقم (${
                  n || ""
                }) في نظامنا مسبقًا. اضغط على الزر أدناه لفتح الواتساب ثم اضغط "إرسال" داخل الدردشة.`
              : `Your order #${
                  n || ""
                } has been saved in our system. Tap the green button to open WhatsApp, then press SEND inside the chat.`}
          </p>

          {orderRef}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onSendClick}
              className="btn-tap inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#25D366]/25 hover:bg-[#1ebe5d]"
            >
              <WhatsAppIcon className="h-5 w-5" />
              {isAr ? "تأكيد وإرسال الطلب عبر الواتساب" : "Confirm & Send Order on WhatsApp"}
            </a>

            <Link
              to="/"
              className="btn-tap inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              {isAr ? "العودة للمتجر" : "Back to Store"}
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            {isAr
              ? "عادةً ما تستغرق المعالجة أقل من 10 دقائق بعد الإرسال."
              : "Order processing usually takes less than 10 minutes after sending."}
          </p>
        </section>
      </Layout>
    );
  }

  // -------------------------------- STATE 2️⃣: OPENED — user clicked WhatsApp but hasn't explicitly confirmed send yet
  if (status === "opened") {
    return (
      <Layout>
        <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#25D366]/10 text-[#1ebe5d]">
            <MessageCircle className="h-10 w-10" />
          </div>

          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">
            {isAr ? "هل أرسلت الرسالة؟" : "Did you tap SEND in WhatsApp?"}
          </h1>

          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            {isAr
              ? "إذا تم فتح الواتساب وقمت بالضغط على زر الإرسال — اضغط الزر الأوّل أدناه لتأكيد الوصول. إذا كنت تحتاج لإعادة فتح الرسالة مرة أخرى للضغط إرسال، استخدم الزر الثاني."
              : `If WhatsApp opened and you pressed SEND, click Yes, I sent my order below. If you need the message re-opened, click Re-open WhatsApp.`}
          </p>

          {orderRef}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onConfirmSent}
              className="btn-tap inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-5 w-5" />
              {isAr ? "نعم، تم إرسال الطلب ✓" : "Yes, I sent my order ✓"}
            </button>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onSendClick}
              className="btn-tap inline-flex items-center justify-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-6 py-3.5 text-sm font-semibold text-[#12a04e] hover:bg-[#25D366]/20"
            >
              <RotateCcw className="h-4 w-4" />
              {isAr ? "إعادة فتح الواتساب" : "Re-open WhatsApp"}
            </a>
          </div>

          <Link
            to="/"
            className="mt-3 inline-flex items-center justify-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {isAr ? "أو العودة للمتجر" : "Or go back to the store"}
          </Link>

          <p className="mt-6 text-xs text-muted-foreground">
            {isAr
              ? "ملاحظة: بيانات الطلب محفوظة بالفعل لدى فريقنا، لكن تأكيدك يساعدنا أن نبدأ التجهيز فورًا."
              : "Note: Your order details are already saved with our team. Confirming helps us begin preparation immediately."}
          </p>
        </section>
      </Layout>
    );
  }

  // -------------------------------- STATE 3️⃣: CONFIRMED (either user clicked "I sent" or 30min auto-heuristic)
  return (
    <Layout>
      <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-600/10 text-emerald-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <h1 className="mt-6 text-2xl font-bold sm:text-3xl">
          {isAr ? "تم استلام طلبك! 🎉" : "Order Received — Thank You! 🎉"}
        </h1>

        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          {isAr
            ? `شكرًا لك! لقد تأكدنا من استلام تفاصيل طلبك رقم (${
                n || ""
              }). سيقوم فريقنا بالمراجعة والتواصل معك خلال 10 دقائق لتأكيد التسليم.`
            : `Thank you! We have your order #${
                n || ""
              }. Our team will review it and contact you within 10 minutes to confirm delivery.`}
        </p>

        {orderRef}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="btn-tap inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
          >
            {isAr ? "متابعة التسوق" : "Continue Shopping"}
          </Link>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onSendClick}
            className="btn-tap inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {isAr ? "مراسلة الفريق مرة أخرى" : "Message the team again"}
          </a>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          {isAr
            ? "يمكنك دائمًا متابعة حالة الطلب من صفحة حسابك الشخصي عند تسجيل الدخول."
            : "You can always track your order's progress from your account page when you're signed in."}
        </p>
      </section>
      <PickupLocationModal open={locModalOpen} onClose={() => setLocModalOpen(false)} />
    </Layout>
  );
}
