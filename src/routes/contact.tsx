import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";
import { STORE } from "@/lib/store";
import { MapPin, Phone, MessageCircle, Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  component: Contact,
  head: () => ({
    meta: [
      { title: "Contact BBM — Juba, South Sudan" },
      {
        name: "description",
        content: "Reach BBM in Munuki, Block B, Juba by phone, WhatsApp or email.",
      },
      { property: "og:title", content: "Contact BBM" },
      { property: "og:description", content: "Reach us in Munuki, Block B, Juba." },
    ],
  }),
});

function Contact() {
  const { t, lang } = useI18n();
  const items = [
    {
      icon: MapPin,
      label: t("contact.address"),
      value: lang === "ar" ? STORE.address.ar : STORE.address.en,
    },
    { icon: Phone, label: t("contact.phone"), value: STORE.phonePrimary },
    { icon: MessageCircle, label: t("contact.whatsapp"), value: STORE.whatsapp },
    { icon: Mail, label: t("contact.email"), value: STORE.email },
  ];
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold sm:text-5xl">{t("contact.title")}</h1>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {items.map((it) => (
            <li
              key={it.label}
              className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-5"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/40">
                <it.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {it.label}
                </div>
                <div className="mt-1 font-medium">{it.value}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
