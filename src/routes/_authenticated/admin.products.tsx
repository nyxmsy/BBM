import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { listAllProducts, saveProduct, deleteProduct } from "@/lib/admin.functions";
import { adjustInventory } from "@/lib/orders.functions";
import { auth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/products";
import { formatSSP } from "@/lib/format";
import { Loader2, Plus, Trash2, Pencil, Upload, ImageOff, Package, ImagePlus } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useI18n, bilingual } from "@/lib/i18n";
import { uploadProductPhoto, deleteProductPhoto } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsAdmin,
});

type Row = {
  slug: string;
  name_en: string;
  name_ar: string;
  desc_en: string;
  desc_ar: string;
  price: number;
  compare_at: number | null;
  category: string;
  tint: string;
  image_url: string | null;
  stock: number;
  featured: boolean;
  best_seller: boolean;
  new_arrival: boolean;
  active: boolean;
  sort_order: number;
};

type PhotoState =
  | { kind: "empty" }
  | { kind: "stored"; publicUrl: string; path?: string }
  | { kind: "removed"; previousPath?: string };

const empty: Row = {
  slug: "",
  name_en: "",
  name_ar: "",
  desc_en: "",
  desc_ar: "",
  price: 0,
  compare_at: null,
  category: "kitchen",
  tint: "oklch(0.92 0.03 75)",
  image_url: null,
  stock: 0,
  featured: false,
  best_seller: false,
  new_arrival: false,
  active: true,
  sort_order: 0,
};

function isStorageImagePublicUrl(url: string): boolean {
  return (
    url.includes("/storage/v1/object/public/product-photos/") ||
    (url.startsWith("https://") && url.includes("supabase") && url.includes("/product-photos/"))
  );
}

function extractStoragePath(url: string): string | undefined {
  if (!isStorageImagePublicUrl(url)) return undefined;
  try {
    const parsed = new URL(url);
    const idx = parsed.pathname.indexOf("/product-photos/");
    if (idx < 0) return undefined;
    return decodeURIComponent(parsed.pathname.slice(idx + "/product-photos/".length));
  } catch {
    return undefined;
  }
}

const input =
  "w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

function ProductsAdmin() {
  const { t, lang } = useI18n();
  const fetchAll = useServerFn(listAllProducts);
  const save = useServerFn(saveProduct);
  const del = useServerFn(deleteProduct);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Row | null>(null);
  const [photoState, setPhotoState] = useState<PhotoState>({ kind: "empty" });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      return await fetchAll({ data: { accessToken: token } });
    },
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  const saveMut = useMutation({
    mutationFn: async (row: Row & { remove_photo?: boolean }) => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      return await save({ data: { ...row, accessToken: token } });
    },
    onSuccess: async () => {
      // Clean up old storage photo when replacing/removing (best-effort, non-blocking)
      if (photoState.kind === "removed" && photoState.previousPath) {
        void deleteProductPhoto(photoState.previousPath);
      }
      invalidate();
      setDraft(null);
      setPhotoState({ kind: "empty" });
    },
  });
  const delMut = useMutation({
    mutationFn: async (slug: string) => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      return await del({ data: { slug, accessToken: token } });
    },
    onSuccess: invalidate,
  });

  if (isLoading)
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" />;
  const rows = (data ?? []) as unknown as Row[];

  const set = <K extends keyof Row>(k: K, v: Row[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const openDraft = (base: Row) => {
    setDraft({ ...base });
    if (base.image_url) {
      setPhotoState({
        kind: "stored",
        publicUrl: base.image_url,
        path: extractStoragePath(base.image_url),
      });
    } else {
      setPhotoState({ kind: "empty" });
    }
    setUploadErr(null);
    setUploadProgress(null);
  };

  const closeDraft = () => {
    // Best-effort cleanup of uploads made in this draft that were never saved.
    if (photoState.kind === "stored" && photoState.path && draft) {
      const previousUrl = rows.find((r) => r.slug === draft.slug)?.image_url;
      if (!previousUrl || previousUrl !== photoState.publicUrl) {
        void deleteProductPhoto(photoState.path);
      }
    }
    setDraft(null);
    setPhotoState({ kind: "empty" });
    setUploadErr(null);
    setUploadProgress(null);
  };

  const uploadImage = async (file: File) => {
    setUploadErr(null);
    setUploadProgress(0);
    try {
      if (!draft?.slug || draft.slug.length < 2) {
        throw new Error("Pick a slug first so we can organise the photo");
      }
      const { publicUrl, path } = await uploadProductPhoto({
        file,
        slug: draft.slug,
        onProgress: (p) => setUploadProgress(p),
      });

      // Replacing a previously-uploaded storage photo in the same session?
      // Schedule it for cleanup once save succeeds.
      const previousPath = photoState.kind === "stored" ? photoState.path : undefined;

      setPhotoState({ kind: "stored", publicUrl, path });
      set("image_url", publicUrl);
      setUploadProgress(null);

      // Best-effort delete the newly-replaced file if it was one we uploaded (cleanup)
      if (previousPath && photoState.kind === "stored") {
        const previousIsSaved = rows.some(
          (r) => r.slug === draft.slug && r.image_url === photoState.publicUrl,
        );
        if (!previousIsSaved) void deleteProductPhoto(previousPath);
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress(null);
    }
  };

  const onPickFile = (f: File | undefined) => {
    if (f) void uploadImage(f);
  };

  const removePhoto = () => {
    const current = photoState.kind === "stored" ? photoState : undefined;
    setPhotoState({ kind: "removed", previousPath: current?.path });
    set("image_url", null);
  };

  const tryRemovePhoto = () => {
    const msg = lang === "ar" ? "هل تريد بالتأكيد حذف صورة المنتج؟" : "Remove this product photo?";
    if (window.confirm(msg)) removePhoto();
  };

  const photoPublicUrl = photoState.kind === "stored" ? photoState.publicUrl : null;

  const hasPhoto = !!photoPublicUrl;

  const effectivePhotoUrl =
    photoPublicUrl || (photoState.kind === "empty" && draft?.image_url ? draft.image_url : null);

  const finalDraftForSave = draft
    ? {
        ...draft,
        image_url: photoPublicUrl || null,
        remove_photo: photoState.kind === "removed",
      }
    : null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalDraftForSave) return;
    if (!finalDraftForSave.image_url) return;
    saveMut.mutate(finalDraftForSave);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("admin.productstitle")}</h1>
        <button
          onClick={() => openDraft({ ...empty })}
          className="btn-tap inline-flex items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> {t("admin.newproduct")}
        </button>
      </div>

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeDraft}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {draft.slug && rows.some((r) => r.slug === draft.slug)
                  ? t("admin.edit")
                  : t("admin.newproduct")}
              </h2>
              <button
                type="button"
                onClick={closeDraft}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <L label={t("admin.slug")}>
                  <input
                    className={input}
                    required
                    value={draft.slug}
                    onChange={(e) => set("slug", e.target.value)}
                    placeholder="ceramic-dinner-set"
                  />
                </L>
                <L label={t("admin.category")}>
                  <select
                    className={input}
                    value={draft.category}
                    onChange={(e) => set("category", e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {bilingual(c.name, lang)}
                      </option>
                    ))}
                  </select>
                </L>
                <L label={t("admin.name_en")}>
                  <input
                    className={input}
                    required
                    value={draft.name_en}
                    onChange={(e) => set("name_en", e.target.value)}
                  />
                </L>
                <L label={t("admin.name_ar")}>
                  <input
                    className={input}
                    required
                    dir="rtl"
                    value={draft.name_ar}
                    onChange={(e) => set("name_ar", e.target.value)}
                  />
                </L>
                <L label={t("admin.desc_en")}>
                  <textarea
                    className={input}
                    rows={2}
                    value={draft.desc_en}
                    onChange={(e) => set("desc_en", e.target.value)}
                  />
                </L>
                <L label={t("admin.desc_ar")}>
                  <textarea
                    className={input}
                    rows={2}
                    dir="rtl"
                    value={draft.desc_ar}
                    onChange={(e) => set("desc_ar", e.target.value)}
                  />
                </L>
                <L label={t("admin.price")}>
                  <input
                    className={input}
                    type="number"
                    min={0}
                    value={draft.price}
                    onChange={(e) => set("price", Number(e.target.value))}
                  />
                </L>
                <L label={t("admin.compare_at")}>
                  <input
                    className={input}
                    type="number"
                    min={0}
                    value={draft.compare_at ?? ""}
                    onChange={(e) =>
                      set("compare_at", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </L>
                <L label={t("admin.stock")}>
                  <input
                    className={input}
                    type="number"
                    min={0}
                    value={draft.stock}
                    onChange={(e) => set("stock", Number(e.target.value))}
                  />
                </L>
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("admin.photo")}
                    <span className="ms-1 text-destructive">*</span>
                  </span>
                  <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-dashed border-border bg-secondary/30 p-4">
                    <div className="relative grid h-40 w-40 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-background">
                      {hasPhoto ? (
                        <img
                          src={photoPublicUrl!}
                          alt={lang === "ar" ? "معاينة صورة المنتج" : "Product preview"}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : effectivePhotoUrl ? (
                        <img
                          src={effectivePhotoUrl}
                          alt={lang === "ar" ? "معاينة صورة المنتج" : "Product preview"}
                          className="absolute inset-0 h-full w-full object-cover opacity-70"
                        />
                      ) : (
                        <ImageOff className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="btn-tap inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60">
                          {uploadProgress !== null ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {lang === "ar"
                                ? `جارٍ الرفع… ${uploadProgress}%`
                                : `Uploading… ${uploadProgress}%`}
                            </>
                          ) : hasPhoto ? (
                            <>
                              <Upload className="h-4 w-4" />
                              {lang === "ar" ? "استبدال الصورة" : "Replace photo"}
                            </>
                          ) : (
                            <>
                              <ImagePlus className="h-4 w-4" />
                              {lang === "ar" ? "إضافة صورة" : "Add photo"}
                            </>
                          )}
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                            className="hidden"
                            disabled={uploadProgress !== null}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              onPickFile(f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {hasPhoto && (
                          <button
                            type="button"
                            onClick={tryRemovePhoto}
                            className="btn-tap inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/5 px-5 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            {lang === "ar" ? "إزالة الصورة" : "Remove photo"}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {lang === "ar"
                          ? "JPG أو PNG فقط. يتم ضغط الصورة وتغيير حجمها تلقائيًا لأفضل أداء على الموقع."
                          : "JPG or PNG only. The image is automatically resized and compressed for the fastest page loads."}
                      </p>
                      {uploadErr && <p className="text-xs text-destructive">{uploadErr}</p>}
                      {!hasPhoto && (
                        <p className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <Package className="h-3 w-3" />
                          {lang === "ar"
                            ? "لا يمكن الحفظ بدون صورة."
                            : "Save is blocked until a photo is uploaded."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <L label="Sort order">
                  <input
                    className={input}
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => set("sort_order", Number(e.target.value))}
                  />
                </L>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <Chk label="Featured" v={draft.featured} on={(v) => set("featured", v)} />
                <Chk label="Best seller" v={draft.best_seller} on={(v) => set("best_seller", v)} />
                <Chk label="New arrival" v={draft.new_arrival} on={(v) => set("new_arrival", v)} />
                <Chk label="Visible in shop" v={draft.active} on={(v) => set("active", v)} />
                <Chk
                  label="Sold out"
                  v={draft.stock === 0}
                  on={(v) => set("stock", v ? 0 : Math.max(1, draft.stock))}
                />
              </div>
              {saveMut.isError && (
                <p className="text-sm text-destructive">
                  Could not save. Check the fields and try again.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saveMut.isPending || uploadProgress !== null || !hasPhoto}
                  className="btn-tap rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saveMut.isPending ? t("admin.saving") : t("admin.save")}
                </button>
                <button
                  type="button"
                  onClick={closeDraft}
                  className="btn-tap rounded-full border border-border px-6 text-sm font-semibold"
                >
                  {t("admin.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {rows.map((p) => (
          <li
            key={p.slug}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-card p-4"
          >
            <div
              className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl text-2xl"
              style={{ background: p.tint }}
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <CategoryIcon slug={p.category} className="h-6 w-6 text-foreground/60" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{lang === "ar" ? p.name_ar : p.name_en}</div>
              <div className="text-sm text-muted-foreground">
                {formatSSP(p.price, lang)} ·{" "}
                {p.stock === 0 ? (
                  <span className="font-medium text-destructive">{t("product.out")}</span>
                ) : (
                  `${t("product.stock")} ${p.stock}`
                )}{" "}
                ·{" "}
                {p.active
                  ? lang === "ar"
                    ? "مرئي"
                    : "visible"
                  : lang === "ar"
                    ? "مخفي"
                    : "hidden"}
              </div>
            </div>
            <button
              onClick={() => openDraft(p as Row)}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (confirm(`${t("admin.delete")} ${lang === "ar" ? p.name_ar : p.name_en}?`))
                  delMut.mutate(p.slug);
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-destructive hover:bg-destructive/10"
              aria-label={t("admin.delete")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Chk({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={v}
        onChange={(e) => on(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}
