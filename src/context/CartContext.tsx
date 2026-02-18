import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CartItem, Product } from '../types';

type CartCtx = {
  items: CartItem[];
  add: (p: Product, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = 'aca_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = (product: Product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { product, qty }];
    });
  };

  const remove = (productId: string) => setItems((prev) => prev.filter((i) => i.product.id !== productId));

  const setQty = (productId: string, qty: number) =>
    setItems((prev) => prev.map((i) => (i.product.id === productId ? { ...i, qty } : i)).filter((i) => i.qty > 0));

  const clear = () => setItems([]);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.product.price * i.qty, 0), [items]);

  const value = useMemo(() => ({ items, add, remove, setQty, clear, subtotal }), [items, subtotal]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
