import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAnonServerClient } from "../../supabase/client.server";
import { MapPin, Clock, Phone, Store, X, Navigation } from "lucide-react";
import { useI18n, bilingual } from "@/lib/i18n";
import { Loader2 } from "lucide-react";

export type StoreSettingsView = {
  store_name_en: string;
  store_name_ar: string;
  address_en: string;
  address_ar: string;
  opening_hours_en: string;
  opening_hours_ar: string;
  phone: string;
  whatsapp: string;
  map_lat: number | null;
  map_lng: number | null;
  map_embed_url: string | null;
};

export const getStoreSettingsView = createServerFn({ method: "POST" })
  .inputValidator((_d: unknown) => undefined)
  .handler(async (): Promise<StoreSettingsView> => {
    try {
      const supabase = getAnonServerClient();
      const { data, error } = await supabase
        .from("store_settings")
        .select(
          "store_name_en, store_name_ar, address_en, address_ar, opening_hours_en, opening_hours_ar, phone, whatsapp, map_lat, map_lng, map_embed_url",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          store_name_en: "BBM Household Store",
          store_name_ar: "مخازن بي بي إم للمنزل",
          address_en: "Munuki Block B, Juba, South Sudan",
          address_ar: "مونكي بلوك بي، جوبا، جنوب السودان",
          opening_hours_en: "Mon–Sat: 8:00 AM – 8:00 PM · Sun: 10:00 AM – 6:00 PM",
          opening_hours_ar: "السبت-الإثنين: 8 ص – 8 م · الأحد: 10 ص – 6 م",
          phone: "+211 922 000 000",
          whatsapp: "+211922000000",
          map_lat: null,
          map_lng: null,
          map_embed_url: null,
        };
      }
      return data as StoreSettingsView;
    } catch {
      return {
        store_name_en: "BBM Household Store",
        store_name_ar: "مخازن بي بي إم للمنزل",
        address_en: "Munuki Block B, Juba, South Sudan",
        address_ar: "مونكي بلوك بي، جوبا، جنوب السودان",
        opening_hours_en: "Mon–Sat: 8:00 AM – 8:00 PM · Sun: 10:00 AM – 6:00 PM",
        opening_hours_ar: "السبت-الإثنين: 8 ص – 8 م · الأحد: 10 ص – 6 م",
        phone: "+211 922 000 000",
        whatsapp: "+211922000000",
        map_lat: null,
        map_lng: null,
        map_embed_url: null,
      };
    }
  });

export function PickupLocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useI18n();
  const [data, setData] = useState<StoreSettingsView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    getStoreSettingsView({ data: {} })
      .then((s) => {
        if (alive) setData(s);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  const s = data;
  const gmapsLink =
    s?.map_lat && s?.map_lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${s.map_lat},${s.map_lng}`
      : s?.address_en
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address_en)}`
        : null;

  const title =
    lang === "ar"
      ? {
          heading: s?.store_name_ar || s?.store_name_en || "موقع المتجر",
          sub: "تفاصيل الاستلام من المتجر",
          addressLabel: "العنوان",
          hoursLabel: "ساعات العمل",
          phoneLabel: "الهاتف",
          whatsappLabel: "واتساب",
          directions: "فتح الاتجاهات",
          close: "إغلاق",
          loading: "جارٍ تحميل موقع المتجر…",
        }
      : {
          heading: s?.store_name_en || s?.store_name_ar || "Store location",
          sub: "Pickup details",
          addressLabel: "Address",
          hoursLabel: "Opening hours",
          phoneLabel: "Phone",
          whatsappLabel: "WhatsApp",
          directions: "Directions",
          close: "Close",
          loading: "Loading store location…",
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-border/60 bg-card shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-primary">
              <MapPin className="h-4 w-4" />
              {title.sub}
            </div>
            <h3 className="mt-0.5 text-lg font-bold">{title.heading}</h3>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
            onClick={onClose}
            aria-label={title.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading || !s ? (
          <div className="grid place-items-center p-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{title.loading}</p>
          </div>
        ) : (
          <div>
            {s.map_embed_url ? (
              <div className="aspect-[4/3] w-full border-b border-border/60 bg-secondary/40">
                <iframe
                  title={title.heading}
                  src={s.map_embed_url}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            ) : s.map_lat && s.map_lng ? (
              <a
                href={gmapsLink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block aspect-[4/3] w-full overflow-hidden border-b border-border/60"
                style={{
                  background: "linear-gradient(135deg, oklch(0.86 0.05 140), oklch(0.84 0.05 230))",
                }}
              >
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid max-w-sm gap-2 text-center px-4">
                    <MapPin className="mx-auto h-9 w-9 text-primary" />
                    <p className="font-semibold">{title.directions}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.map_lat.toFixed(4)}, {s.map_lng.toFixed(4)}
                    </p>
                  </div>
                </div>
              </a>
            ) : (
              <div className="aspect-[4/3] w-full border-b border-border/60 bg-secondary/40 grid place-items-center text-muted-foreground">
                <Store className="h-12 w-12" />
              </div>
            )}

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {title.addressLabel}
                </div>
                <p className="mt-1">
                  {bilingual({ en: s.address_en, ar: s.address_ar || s.address_en }, lang)}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {title.hoursLabel}
                </div>
                <p className="mt-1">
                  {bilingual(
                    {
                      en: s.opening_hours_en,
                      ar: s.opening_hours_ar || s.opening_hours_en,
                    },
                    lang,
                  )}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {title.phoneLabel}
                </div>
                <a
                  className="mt-1 inline-flex items-center underline underline-offset-4 hover:text-primary"
                  href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
                >
                  {s.phone}
                </a>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {title.whatsappLabel}
                </div>
                <a
                  className="mt-1 inline-flex items-center underline underline-offset-4 hover:text-primary"
                  href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.whatsapp}
                </a>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-tap rounded-full border border-border px-5 py-2 text-sm font-semibold"
              >
                {title.close}
              </button>
              {gmapsLink && (
                <a
                  href={gmapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-tap inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Navigation className="h-4 w-4" />
                  {title.directions}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
