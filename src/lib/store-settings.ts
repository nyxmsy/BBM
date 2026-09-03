import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAnonServerClient } from "../../supabase/client.server";
import { STORE } from "@/lib/store";

export type StoreSettingsView = {
  store_name_en: string;
  store_name_ar: string;
  address_en: string;
  address_ar: string;
  opening_hours_en: string;
  opening_hours_ar: string;
  phone: string;
  whatsapp: string;
  email: string;
  map_lat: number | null;
  map_lng: number | null;
  map_embed_url: string | null;
};

const FALLBACK: StoreSettingsView = {
  store_name_en: STORE.name,
  store_name_ar: STORE.name,
  address_en: STORE.address.en,
  address_ar: STORE.address.ar,
  opening_hours_en: STORE.hours.en,
  opening_hours_ar: STORE.hours.ar,
  phone: STORE.phonePrimary,
  whatsapp: STORE.whatsapp,
  email: STORE.email,
  map_lat: null,
  map_lng: null,
  map_embed_url: null,
};

export const getStoreSettingsView = createServerFn({ method: "POST" })
  .inputValidator((_d: unknown) => undefined)
  .handler(async (): Promise<StoreSettingsView> => {
    try {
      const supabase = getAnonServerClient();
      const { data, error } = await supabase
        .from("store_settings")
        .select(
          "store_name_en, store_name_ar, address_en, address_ar, opening_hours_en, opening_hours_ar, phone, whatsapp, email, map_lat, map_lng, map_embed_url",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return FALLBACK;
      const row = data as Record<string, unknown>;
      return {
        store_name_en: (row.store_name_en as string) || FALLBACK.store_name_en,
        store_name_ar: (row.store_name_ar as string) || FALLBACK.store_name_ar,
        address_en: (row.address_en as string) || FALLBACK.address_en,
        address_ar: (row.address_ar as string) || FALLBACK.address_ar,
        opening_hours_en: (row.opening_hours_en as string) || FALLBACK.opening_hours_en,
        opening_hours_ar: (row.opening_hours_ar as string) || FALLBACK.opening_hours_ar,
        phone: (row.phone as string) || FALLBACK.phone,
        whatsapp: (row.whatsapp as string) || FALLBACK.whatsapp,
        email: (row.email as string) || FALLBACK.email,
        map_lat: (row.map_lat as number | null) ?? null,
        map_lng: (row.map_lng as number | null) ?? null,
        map_embed_url: (row.map_embed_url as string | null) ?? null,
      };
    } catch {
      return FALLBACK;
    }
  });

const queryKey = ["store-settings-view"];

export function useStoreSettings(): StoreSettingsView {
  const q = useQuery({
    queryKey,
    queryFn: async () => await getStoreSettingsView({ data: {} }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  return q.data ?? FALLBACK;
}

export const STORE_SETTINGS_FALLBACK = FALLBACK;
