import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adjustInventory } from "@/lib/orders.functions";
import { getInventoryDashboard } from "@/lib/admin.functions";
import { auth } from "@/lib/auth";
import { formatSSP } from "@/lib/format";
import { Loader2, Plus, Minus, TrendingUp, TrendingDown, Package } from "lucide-react";
import { useState } from "react";
import { useI18n, bilingual } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  component: InventoryAdmin,
});

type InventoryRow = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  stock: number;
  price: number;
  category: string;
  is_active: boolean;
  total_sold: number;
  total_restored: number;
  order_count: number;
};

function InventoryAdmin() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const adjustFn = useServerFn(adjustInventory);
  const inventoryFn = useServerFn(getInventoryDashboard);
  const [selectedProduct, setSelectedProduct] = useState<InventoryRow | null>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      
      const rows = await inventoryFn({ data: { accessToken: token } });
      return rows as InventoryRow[];
    },
  });

  const adjustMut = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("No product selected");
      const { data: sessionData } = await auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");
      
      const result = await adjustFn({
        data: {
          accessToken: token,
          productId: selectedProduct.id,
          quantityChange: adjustment,
          reason: reason || "Manual adjustment",
        },
      });
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedProduct(null);
      setAdjustment(0);
      setReason("");
    },
  });

  if (isLoading)
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" />;
  if (error)
    return <p className="text-sm text-destructive">{t("admin.inventory")}: {error.message}</p>;

  const inventory = data ?? [];
  const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
  const totalSold = inventory.reduce((sum, item) => sum + Math.abs(item.total_sold), 0);
  const lowStock = inventory.filter((item) => item.stock < 5 && item.is_active);

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{t("admin.inventorytitle")}</h1>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("admin.totalproducts")} value={String(inventory.length)} icon={<Package className="h-4 w-4" />} />
        <Stat label={t("admin.totalstock")} value={String(totalStock)} icon={<Package className="h-4 w-4" />} />
        <Stat label={t("admin.itemssold")} value={String(totalSold)} icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label={t("admin.lowstock")} value={String(lowStock.length)} icon={<TrendingDown className="h-4 w-4" />} warning={lowStock.length > 0} />
      </div>

      {inventory.length === 0 ? (
        <p className="mt-10 text-muted-foreground">{lang === "ar" ? "لا توجد بيانات مخزون." : "No inventory data available."}</p>
      ) : (
        <>
          {lowStock.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h3 className="font-semibold text-amber-700">{t("admin.lowstockalert")}</h3>
              <p className="mt-1 text-sm text-amber-600">
                {lowStock.length} {t("admin.lowstockmsg")}
              </p>
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-3xl border border-border/60 bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-secondary/30">
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Sold</th>
                  <th className="px-4 py-3 text-right font-semibold">Orders</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.id} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name_en}</div>
                      <div className="text-xs text-muted-foreground">{item.slug}</div>
                      {!item.is_active && (
                        <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-display font-semibold ${item.stock < 5 ? "text-amber-600" : ""}`}>
                      {item.stock}
                    </td>
                    <td className="px-4 py-3 text-right">{formatSSP(item.price, "en")}</td>
                    <td className="px-4 py-3 text-right">{Math.abs(item.total_sold)}</td>
                    <td className="px-4 py-3 text-right">{item.order_count}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedProduct(item)}
                        className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6">
            <h2 className="text-lg font-semibold">Adjust Stock</h2>
            <div className="mt-4 space-y-4">
              <div>
                <div className="font-medium">{selectedProduct.name_en}</div>
                <div className="text-sm text-muted-foreground">Current stock: {selectedProduct.stock}</div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Quantity Change</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustment((prev) => prev - 1)}
                    className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-secondary"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    value={adjustment}
                    onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                    className="w-20 rounded-xl border border-input bg-background px-3 py-2 text-center font-display font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustment((prev) => prev + 1)}
                    className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-secondary"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  New stock: {selectedProduct.stock + adjustment}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Reason (optional)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Restock, Damaged goods, etc."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => adjustMut.mutate()}
                  disabled={adjustMut.isPending || adjustment === 0}
                  className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {adjustMut.isPending ? "Adjusting..." : "Confirm Adjustment"}
                </button>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setAdjustment(0);
                    setReason("");
                  }}
                  className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ 
  label, 
  value, 
  icon, 
  warning = false 
}: { 
  label: string; 
  value: string; 
  icon?: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-4 ${warning ? "border-amber-500/50 bg-amber-500/10" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}