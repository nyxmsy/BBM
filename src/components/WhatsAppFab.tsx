import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STORE } from "@/lib/store";

export function WhatsAppFab() {
  const { t } = useI18n();
  const href = `https://wa.me/${STORE.whatsapp.replace(/[^0-9]/g, "")}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("wa.help")}
      className="fixed bottom-18 end-4 lg:bottom-5 lg:end-5 z-40 inline-flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-full bg-[oklch(0.66_0.17_150)] text-white shadow-xl transition hover:scale-105 active:scale-95"
    >
      <MessageCircle className="h-7 w-7" />
      <span className="sr-only">{t("wa.help")}</span>
    </a>
  );
}
