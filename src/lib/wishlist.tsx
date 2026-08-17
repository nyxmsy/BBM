import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = {
  items: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
};

const Ctx = createContext<Ctx | null>(null);
const KEY = "bbm.wishlist.v1";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<string[]>([]);
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
  const toggle = (slug: string) =>
    setItems((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  const has = (slug: string) => items.includes(slug);
  return <Ctx.Provider value={{ items, toggle, has }}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWishlist outside provider");
  return c;
}
