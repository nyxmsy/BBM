import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAllProducts, saveProduct, deleteProduct } from "@/lib/admin.functions";
import { auth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/products";
import { formatSSP } from "@/lib/format";
import { Loader2, Plus, Trash2, Pencil, Upload, ImageOff } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";

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

const input =
  "w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

function ProductsAdmin() {
  const fetchAll = useServerFn(listAllProducts);
  const save = useServerFn(saveProduct);
  const del = useServerFn(deleteProduct);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Row | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

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
    mutationFn: async (row: Row) => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      return await save({ data: { ...row, accessToken: token } });
    },
    onSuccess: () => {
      invalidate();
      setDraft(null);
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

  const uploadImage = async (file: File) => {
    setUploadErr(null);
    setUploading(true);
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be smaller than 5MB");
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          set("image_url", reader.result);
          setUploading(false);
        }
      };
      reader.onerror = () => {
        setUploadErr("Failed to read image file");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Products</h1>
        <button
          onClick={() => setDraft({ ...empty })}
          className="btn-tap inline-flex items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New product
        </button>
      </div>

      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate(draft);
          }}
          className="mt-6 space-y-4 rounded-3xl border border-border/60 bg-card p-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Slug (url id)">
              <input
                className={input}
                required
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="ceramic-dinner-set"
              />
            </L>
            <L label="Category">
              <select
                className={input}
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name.en}
                  </option>
                ))}
              </select>
            </L>
            <L label="Name (English)">
              <input
                className={input}
                required
                value={draft.name_en}
                onChange={(e) => set("name_en", e.target.value)}
              />
            </L>
            <L label="Name (Arabic)">
              <input
                className={input}
                required
                dir="rtl"
                value={draft.name_ar}
                onChange={(e) => set("name_ar", e.target.value)}
              />
            </L>
            <L label="Description (English)">
              <textarea
                className={input}
                rows={2}
                value={draft.desc_en}
                onChange={(e) => set("desc_en", e.target.value)}
              />
            </L>
            <L label="Description (Arabic)">
              <textarea
                className={input}
                rows={2}
                dir="rtl"
                value={draft.desc_ar}
                onChange={(e) => set("desc_ar", e.target.value)}
              />
            </L>
            <L label="Price (SSP)">
              <input
                className={input}
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) => set("price", Number(e.target.value))}
              />
            </L>
            <L label="Compare-at price (optional)">
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
            <L label="Stock">
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
                Product photo (required)
              </span>
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-border bg-secondary/30 p-4">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-background">
                  {draft.image_url ? (
                    <img
                      src={draft.image_url}
                      alt="Product preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="btn-tap inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading…" : draft.image_url ? "Replace photo" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadImage(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    JPG or PNG, square photos look best.
                  </p>
                  {uploadErr && <p className="text-xs text-destructive">{uploadErr}</p>}
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
          {!draft.image_url && (
            <p className="text-sm text-muted-foreground">Add a product photo before saving.</p>
          )}
          {saveMut.isError && (
            <p className="text-sm text-destructive">
              Could not save. Check the fields and try again.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveMut.isPending || uploading || !draft.image_url}
              className="btn-tap rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saveMut.isPending ? "Saving…" : "Save product"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="btn-tap rounded-full border border-border px-6 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
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
              <div className="truncate font-medium">{p.name_en}</div>
              <div className="text-sm text-muted-foreground">
                {formatSSP(p.price, "en")} ·{" "}
                {p.stock === 0 ? (
                  <span className="font-medium text-destructive">Sold out</span>
                ) : (
                  `stock ${p.stock}`
                )}{" "}
                · {p.active ? "visible" : "hidden"}
              </div>
            </div>
            <button
              onClick={() => setDraft({ ...(p as Row) })}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete ${p.name_en}?`)) delMut.mutate(p.slug);
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-destructive hover:bg-destructive/10"
              aria-label="Delete"
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
