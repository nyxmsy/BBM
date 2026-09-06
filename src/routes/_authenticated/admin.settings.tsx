import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listDeliveryAreas,
  saveDeliveryArea,
  deleteDeliveryArea,
  getStoreSettings,
  saveStoreSettings,
  type DeliveryArea,
  type StoreSettings,
} from "@/lib/admin.functions";
import { auth } from "@/lib/auth";
import { formatSSP } from "@/lib/format";
import { useI18n, bilingual } from "@/lib/i18n";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Settings as SettingsIcon,
  CheckCircle2,
  X,
  MapPin,
  Map as MapIcon,
  Store,
  Mail,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsAdmin,
  head: () => ({
    meta: [
      { title: "Settings — BBM Admin" },
      { description: "Manage delivery areas and store location." },
    ],
  }),
});

const input =
  "w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-2 ring-transparent focus:border-primary focus:ring-primary/20";

const label = "mb-1 block text-xs font-medium text-muted-foreground";

type AreaDraft = Omit<DeliveryArea, "id"> & { id?: string };

const emptyArea: AreaDraft = {
  name_en: "",
  name_ar: "",
  fee: 0,
  active: true,
  sort_order: 0,
};

function SettingsAdmin() {
  const { t, lang, dir } = useI18n();
  const listAreas = useServerFn(listDeliveryAreas);
  const saveArea = useServerFn(saveDeliveryArea);
  const delArea = useServerFn(deleteDeliveryArea);
  const getSettings = useServerFn(getStoreSettings);
  const saveSettings = useServerFn(saveStoreSettings);
  const qc = useQueryClient();
  const nav = useNavigate();

  const [areaDraft, setAreaDraft] = useState<AreaDraft | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const areasQ = useQuery({
    queryKey: ["delivery-areas"],
    queryFn: async () => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      return await listAreas({
        data: { accessToken: token ?? undefined, includeInactive: true },
      });
    },
  });

  const settingsQ = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => await getSettings({ data: {} }),
  });

  const areaMut = useMutation({
    mutationFn: async (payload: AreaDraft) => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");
      return await saveArea({
        data: payload.id
          ? {
              accessToken: token,
              id: payload.id,
              name_en: payload.name_en,
              name_ar: payload.name_ar || undefined,
              fee: payload.fee,
              active: payload.active,
              sort_order: payload.sort_order,
            }
          : {
              accessToken: token,
              name_en: payload.name_en,
              name_ar: payload.name_ar || undefined,
              fee: payload.fee,
              active: payload.active,
              sort_order: payload.sort_order,
            },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-areas"] });
      setAreaDraft(null);
      flash(lang === "ar" ? "تم حفظ المنطقة" : "Delivery area saved.");
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");
      return await delArea({ data: { accessToken: token, id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-areas"] });
      setConfirmDeleteId(null);
      flash(lang === "ar" ? "تم حذف المنطقة" : "Delivery area removed.");
    },
  });

  const settingsMut = useMutation({
    mutationFn: async (payload: StoreSettings) => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");
      return await saveSettings({
        data: {
          accessToken: token,
          store_name_en: payload.store_name_en,
          store_name_ar: payload.store_name_ar,
          address_en: payload.address_en,
          address_ar: payload.address_ar,
          opening_hours_en: payload.opening_hours_en,
          opening_hours_ar: payload.opening_hours_ar,
          phone: payload.phone,
          whatsapp: payload.whatsapp,
          map_lat: payload.map_lat ?? undefined,
          map_lng: payload.map_lng ?? undefined,
          map_embed_url: payload.map_embed_url ?? undefined,
          facebook_url: payload.facebook_url ?? undefined,
          tiktok_url: payload.tiktok_url ?? undefined,
          pickup_window_days: payload.pickup_window_days,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-settings"] });
      flash(lang === "ar" ? "تم حفظ الإعدادات" : "Store settings saved.");
    },
  });

  function flash(msg: string) {
    setSaveMsg(msg);
    window.setTimeout(() => setSaveMsg(null), 2500);
  }

  if (areasQ.isLoading || settingsQ.isLoading)
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" />;

  const areas = (areasQ.data ?? []) as DeliveryArea[];
  const settings = settingsQ.data as StoreSettings;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {lang === "ar" ? "الإعدادات" : "Settings"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lang === "ar"
              ? "إعدادات التوصيل وموقع المتجر من مكان واحد."
              : "Configure delivery areas and store location in one place."}
          </p>
        </div>
        <div className="inline-flex items-center rounded-full border border-border/80 bg-card/80 p-0.5 text-xs font-medium">
          <Link
            to="/admin/settings"
            className="rounded-full px-4 py-1.5 bg-foreground text-background"
          >
            <CheckCircle2 className="mr-1 inline h-3 w-3" />
            {lang === "ar" ? "الإعدادات" : "Settings"}
          </Link>
        </div>
      </header>

      {saveMsg && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {saveMsg}
        </div>
      )}

      {/* ==================================================== */}
      {/* Section 1: Delivery areas */}
      {/* ==================================================== */}
      <section className="rounded-3xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {lang === "ar" ? "مناطق التوصيل" : "Delivery areas"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "ar"
                ? "أضف وأعد تسمية المناطق وغيّر رسوم التوصيل في أي وقت."
                : "Add, rename and reprice delivery areas at any time."}
            </p>
          </div>
          <button
            onClick={() => setAreaDraft({ ...emptyArea })}
            className="btn-tap inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" />
            {lang === "ar" ? "إضافة منطقة" : "Add delivery area"}
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full text-left text-sm" dir={dir}>
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">{lang === "ar" ? "الاسم" : "Name"}</th>
                <th className="px-4 py-2.5">{t("cart.delivery")}</th>
                <th className="px-4 py-2.5">{lang === "ar" ? "الترتيب" : "Order"}</th>
                <th className="px-4 py-2.5">{lang === "ar" ? "مفعّلة" : "Active"}</th>
                <th className="px-4 py-2.5 text-right">{lang === "ar" ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {areas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {lang === "ar"
                      ? "لا توجد مناطق بعد. اضغط إضافة منطقة للبدء."
                      : "No areas yet — click Add delivery area to start."}
                  </td>
                </tr>
              )}
              {areas.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{a.name_en}</div>
                    {a.name_ar && (
                      <div className="text-xs text-muted-foreground" dir="rtl">
                        {a.name_ar}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {a.fee === 0 ? "—" : formatSSP(a.fee, lang)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{a.sort_order}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        a.active
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.active
                        ? lang === "ar"
                          ? "مفعّلة"
                          : "Active"
                        : lang === "ar"
                          ? "متوقفة"
                          : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
                        onClick={() => setAreaDraft({ ...a })}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteId(a.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================================================== */}
      {/* Section 2: Store location */}
      {/* ==================================================== */}
      <section className="mt-6 rounded-3xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {lang === "ar" ? "موقع المتجر" : "Store location"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "ar"
                ? "يظهر في منبثق موقع الاستلام وأوقات العمل."
                : "Shown on the pickup location popup and opening hours."}
            </p>
          </div>
        </div>

        {(settingsMut.isError || delMut.isError) && (
          <p className="mb-4 text-sm text-destructive">
            {settingsMut.error?.message || delMut.error?.message}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!settingsQ.data) return;
            const fd = new FormData(e.currentTarget);
            const read = (k: string, fallback: string = "") => String(fd.get(k) ?? fallback);
            const num = (k: string, fallback: number) => {
              const v = Number(fd.get(k));
              return Number.isFinite(v) ? v : fallback;
            };
            settingsMut.mutate({
              id: 1,
              store_name_en: read("store_name_en", settings.store_name_en),
              store_name_ar: read("store_name_ar", settings.store_name_ar),
              address_en: read("address_en", settings.address_en),
              address_ar: read("address_ar", settings.address_ar),
              opening_hours_en: read("opening_hours_en", settings.opening_hours_en),
              opening_hours_ar: read("opening_hours_ar", settings.opening_hours_ar),
              phone: read("phone", settings.phone),
              whatsapp: read("whatsapp", settings.whatsapp),
              email: read("email", settings.email),
              facebook_url: read("facebook_url", "").trim() || null,
              tiktok_url: read("tiktok_url", "").trim() || null,
              map_lat: read("map_lat", "") === "" ? null : num("map_lat", 0),
              map_lng: read("map_lng", "") === "" ? null : num("map_lng", 0),
              map_embed_url: read("map_embed_url", "") || null,
              pickup_window_days: Math.max(
                1,
                Math.min(30, num("pickup_window_days", settings.pickup_window_days)),
              ),
              updated_at: new Date().toISOString(),
            } as StoreSettings);
          }}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <div>
            <label className={label}>
              {lang === "ar" ? "اسم المتجر (EN)" : "Store name (EN)"} *
            </label>
            <input
              className={input}
              required
              name="store_name_en"
              defaultValue={settings.store_name_en}
            />
          </div>
          <div>
            <label className={label}>{lang === "ar" ? "اسم المتجر (ع)" : "Store name (AR)"}</label>
            <input
              className={input}
              name="store_name_ar"
              defaultValue={settings.store_name_ar}
              dir="rtl"
            />
          </div>
          <div>
            <label className={label}>{lang === "ar" ? "العنوان (EN)" : "Address (EN)"}</label>
            <textarea
              className={input}
              rows={2}
              name="address_en"
              defaultValue={settings.address_en}
            />
          </div>
          <div>
            <label className={label}>{lang === "ar" ? "العنوان (ع)" : "Address (AR)"}</label>
            <textarea
              className={input}
              rows={2}
              name="address_ar"
              defaultValue={settings.address_ar}
              dir="rtl"
            />
          </div>
          <div>
            <label className={label}>
              {lang === "ar" ? "ساعات العمل (EN)" : "Opening hours (EN)"}
            </label>
            <input
              className={input}
              name="opening_hours_en"
              defaultValue={settings.opening_hours_en}
            />
          </div>
          <div>
            <label className={label}>
              {lang === "ar" ? "ساعات العمل (ع)" : "Opening hours (AR)"}
            </label>
            <input
              className={input}
              name="opening_hours_ar"
              defaultValue={settings.opening_hours_ar}
              dir="rtl"
            />
          </div>
          <div>
            <label className={label}>
              <Store className="mr-1 inline h-3.5 w-3.5" />
              {lang === "ar" ? "هاتف المتجر" : "Store phone"}
            </label>
            <input className={input} name="phone" defaultValue={settings.phone} />
          </div>
          <div>
            <label className={label}>WhatsApp</label>
            <input className={input} name="whatsapp" defaultValue={settings.whatsapp} />
          </div>
          <div>
            <label className={label}>
              <Mail className="mr-1 inline h-3.5 w-3.5" />
              {lang === "ar" ? "البريد الإلكتروني" : "Email"}
            </label>
            <input
              className={input}
              name="email"
              type="email"
              defaultValue={settings.email}
              placeholder="hello@bbm.ss"
            />
          </div>
          <div>
            <label className={label}>
              {lang === "ar" ? "رابط صفحة فيسبوك" : "Facebook page URL"}
            </label>
            <input
              className={input}
              name="facebook_url"
              type="url"
              defaultValue={settings.facebook_url ?? ""}
              placeholder="https://facebook.com/…"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ar"
                ? "يظهر في صفحة اتصل بنا والتذييل. اتركه فارغًا للإخفاء."
                : "Shown on Contact and in the footer. Leave empty to hide."}
            </p>
          </div>
          <div>
            <label className={label}>{lang === "ar" ? "رابط تيك توك" : "TikTok page URL"}</label>
            <input
              className={input}
              name="tiktok_url"
              type="url"
              defaultValue={settings.tiktok_url ?? ""}
              placeholder="https://tiktok.com/@…"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ar"
                ? "يظهر في صفحة اتصل بنا والتذييل. اتركه فارغًا للإخفاء."
                : "Shown on Contact and in the footer. Leave empty to hide."}
            </p>
          </div>
          <div>
            <label className={label}>
              <MapPin className="mr-1 inline h-3.5 w-3.5" /> Latitude
            </label>
            <input
              className={input}
              name="map_lat"
              type="number"
              step="any"
              defaultValue={settings.map_lat ?? ""}
              placeholder="4.8594"
            />
          </div>
          <div>
            <label className={label}>Longitude</label>
            <input
              className={input}
              name="map_lng"
              type="number"
              step="any"
              defaultValue={settings.map_lng ?? ""}
              placeholder="31.5713"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>
              <MapIcon className="mr-1 inline h-3.5 w-3.5" />
              {lang === "ar" ? "رابط iframe للخريطة (اختياري)" : "Map iframe URL (optional)"}
            </label>
            <input
              className={input}
              name="map_embed_url"
              defaultValue={settings.map_embed_url ?? ""}
              placeholder="https://www.google.com/maps/embed?pb=..."
            />
          </div>
          <div>
            <label className={label}>
              {lang === "ar" ? "فترة الاستلام من المتجر (بالأيام)" : "Pickup window (days)"}
            </label>
            <input
              className={input}
              required
              min={1}
              max={30}
              name="pickup_window_days"
              type="number"
              defaultValue={settings.pickup_window_days}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ar"
                ? "إذا مرت هذه المدة بدون استلام، يتم إلغاء الطلب تلقائيًا واستعادة المخزون."
                : "When exceeded, the order is auto-cancelled and inventory is restored."}
            </p>
          </div>

          <div className="sm:col-span-2 flex items-center justify-between border-t border-border/60 pt-4">
            <button
              type="button"
              onClick={() => nav({ to: "/admin" })}
              className="btn-tap rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
            >
              {lang === "ar" ? "العودة للطلبات" : "Back to orders"}
            </button>
            <button
              type="submit"
              disabled={settingsMut.isPending}
              className="btn-tap inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {settingsMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SettingsIcon className="h-4 w-4" />
              )}
              {lang === "ar" ? "حفظ الإعدادات" : "Save settings"}
            </button>
          </div>
        </form>
      </section>

      {/* ==================================================== */}
      {/* Modals: area edit / delete confirm */}
      {/* ==================================================== */}
      {areaDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAreaDraft(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-border/60 bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {areaDraft.id
                  ? lang === "ar"
                    ? "تعديل منطقة التوصيل"
                    : "Edit delivery area"
                  : lang === "ar"
                    ? "منطقة توصيل جديدة"
                    : "New delivery area"}
              </h3>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
                onClick={() => setAreaDraft(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!areaDraft) return;
                areaMut.mutate({ ...areaDraft });
              }}
            >
              <div className="sm:col-span-2">
                <label className={label}>
                  {lang === "ar" ? "اسم المنطقة (EN)" : "Area name (EN)"} *
                </label>
                <input
                  className={input}
                  required
                  value={areaDraft.name_en}
                  onChange={(e) => setAreaDraft({ ...areaDraft, name_en: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>
                  {lang === "ar" ? "اسم المنطقة (ع)" : "Area name (AR)"}
                </label>
                <input
                  className={input}
                  dir="rtl"
                  value={areaDraft.name_ar ?? ""}
                  onChange={(e) => setAreaDraft({ ...areaDraft, name_ar: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>
                  {t("cart.delivery")} ({t("home.currency")}) *
                </label>
                <input
                  className={input}
                  type="number"
                  min={0}
                  required
                  value={areaDraft.fee}
                  onChange={(e) => setAreaDraft({ ...areaDraft, fee: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={label}>{lang === "ar" ? "الترتيب" : "Sort order"}</label>
                <input
                  className={input}
                  type="number"
                  value={areaDraft.sort_order}
                  onChange={(e) =>
                    setAreaDraft({
                      ...areaDraft,
                      sort_order: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={areaDraft.active}
                    onChange={(e) => setAreaDraft({ ...areaDraft, active: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>
                    {lang === "ar" ? "هذه المنطقة مفعّلة للعملاء" : "Show this area to customers"}
                  </span>
                </label>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setAreaDraft(null)}
                  className="btn-tap rounded-full border border-border px-5 py-2 text-sm font-semibold"
                >
                  {t("admin.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={areaMut.isPending}
                  className="btn-tap inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {areaMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("admin.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">
              {lang === "ar" ? "حذف منطقة التوصيل؟" : "Delete this delivery area?"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {lang === "ar"
                ? "لن تظهر هذه المنطقة للعملاء بعد الآن. الطلبات القديمة لن تتأثر."
                : "It will no longer appear to customers. Past orders are not affected."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="btn-tap rounded-full border border-border px-5 py-2 text-sm font-semibold"
              >
                {t("admin.cancel")}
              </button>
              <button
                onClick={() => delMut.mutate(confirmDeleteId)}
                disabled={delMut.isPending}
                className="btn-tap inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {delMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "ar" ? "حذف" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
