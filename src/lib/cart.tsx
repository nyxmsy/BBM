import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = { slug: string; qty: number };

type Ctx = {
  items: CartItem[];
  add: (slug: string, qty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  count: number;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "bbm.cart.v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch (e) {
      void e;
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
      void e;
    }
  }, [items, hydrated]);

  const add = (slug: string, qty = 1) =>
    setItems((prev) => {
      const found = prev.find((i) => i.slug === slug);
      if (found) return prev.map((i) => (i.slug === slug ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { slug, qty }];
    });

  const remove = (slug: string) => setItems((prev) => prev.filter((i) => i.slug !== slug));
  const setQty = (slug: string, qty: number) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.slug !== slug)
        : prev.map((i) => (i.slug === slug ? { ...i, qty } : i)),
    );
  const clear = () => setItems([]);
  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  return (
    <CartCtx.Provider value={{ items, add, remove, setQty, clear, count }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart outside provider");
  return ctx;
}
