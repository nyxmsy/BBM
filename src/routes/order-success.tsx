import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { STORE } from "@/lib/store";

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
  const wa = `https://wa.me/${STORE.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
    (lang === "ar" ? "مرحبًا BBM، رقم طلبي: " : "Hello BBM, my order number is: ") + (n ?? ""),
  )}`;
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
            className="btn-tap inline-flex items-center justify-center gap-2 rounded-full bg-[oklch(0.66_0.17_150)] px-6 text-sm font-semibold text-white"
          >
            <MessageCircle className="h-5 w-5" /> {t("success.whatsapp")}
          </a>
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
