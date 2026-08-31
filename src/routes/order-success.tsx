import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { STORE } from "@/lib/store";
import { WhatsAppIcon, whatsappHref } from "@/components/WhatsAppIcon";
import { generateBusinessWhatsAppMessage, generateBusinessWhatsAppUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/order-success")({
  validateSearch: z.object({ n: z.string().optional() }),
  component: Success,
  head: () => ({
    meta: [
      { title: "Order received — BBM" },
      { name: "description", content: "Thank you for your order." },
      { property: "og:title", content: "Order received — BBM" },
      { property: "og:description", content: "Thank you for your order." },
    ],
  }),
});

function Success() {
  const { n } = Route.useSearch();
  const { t, lang } = useI18n();
  
  // Try to get order details from localStorage
  let orderDetails: any = null;
  try {
    const stored = localStorage.getItem("bbm.lastOrder");
    if (stored) {
      orderDetails = JSON.parse(stored);
    }
  } catch (e) {
    // Ignore storage errors
  }

  // Build WhatsApp message with order details
  let message = "";
  if (lang === "ar") {
    message = `مرحبًا BBM، رقم طلبي: ${n || ""}`;
    if (orderDetails) {
      message += `\n\nالمنتجات:`;
      orderDetails.items?.forEach((item: any) => {
        message += `\n- ${item.name || item.slug} × ${item.qty}`;
      });
      message += `\n\nالإجمالي: ${orderDetails.total || 0} SSP`;
      message += `\nطريقة الدفع: ${orderDetails.payment === "pickup" ? "استلام من المتجر" : "الدفع عند الاستلام"}`;
    }
  } else {
    message = `Hello BBM, my order number is: ${n || ""}`;
    if (orderDetails) {
      message += `\n\nProducts:`;
      orderDetails.items?.forEach((item: any) => {
        message += `\n- ${item.name || item.slug} × ${item.qty}`;
      });
      message += `\n\nTotal: ${orderDetails.total || 0} SSP`;
      message += `\nPayment: ${orderDetails.payment === "pickup" ? "Store pickup" : "Cash on delivery"}`;
    }
  }

  const wa = whatsappHref(STORE.whatsapp, message);
  
  // Generate business WhatsApp notification URL
  let businessWa = "";
  if (orderDetails) {
    const businessMessage = generateBusinessWhatsAppMessage({
      orderNumber: n || "",
      customerName: orderDetails.form?.name || "",
      customerPhone: orderDetails.form?.phone || "",
      items: orderDetails.items || [],
      subtotal: orderDetails.subtotal || 0,
      deliveryFee: orderDetails.deliveryFee || 0,
      total: orderDetails.total || 0,
      paymentMethod: orderDetails.payment || "cod",
      address: orderDetails.form?.address,
      area: orderDetails.form?.area,
      city: orderDetails.form?.city,
      notes: orderDetails.form?.notes,
    }, lang);
    businessWa = generateBusinessWhatsAppUrl(STORE.whatsapp, businessMessage);
  }

  return (
    <Layout>
      <section className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{t("success.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("success.msg")}</p>
        {n && (
          <div className="mt-8 rounded-2xl border border-border/60 bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("success.order")}
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{n}</div>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-tap inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 text-sm font-semibold text-white hover:bg-[#1ebe5d]"
          >
            <WhatsAppIcon className="h-5 w-5" /> {t("success.whatsapp")}
          </a>
          {businessWa && (
            <a
              href={businessWa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tap inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 text-sm font-semibold text-white hover:bg-[#1ebe5d]"
            >
              <MessageCircle className="h-5 w-5" /> {lang === "ar" ? "إرسال للبائع" : "Send to seller"}
            </a>
          )}
          <Link
            to="/"
            className="btn-tap inline-flex items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-semibold"
          >
            {t("success.home")}
          </Link>
        </div>
      </section>
    </Layout>
  );
}
