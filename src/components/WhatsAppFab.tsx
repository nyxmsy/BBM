import { useI18n } from "@/lib/i18n";
import { STORE } from "@/lib/store";
import { WhatsAppIcon, whatsappHref } from "./WhatsAppIcon";

export function WhatsAppFab() {
  const { t } = useI18n();
  return (
    <a
      href={whatsappHref(STORE.whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("wa.help")}
      className="fixed bottom-18 end-4 lg:bottom-5 lg:end-5 z-40 inline-flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105 hover:bg-[#1ebe5d] active:scale-95"
    >
      <WhatsAppIcon className="h-7 w-7" />
      <span className="sr-only">{t("wa.help")}</span>
    </a>
  );
}
