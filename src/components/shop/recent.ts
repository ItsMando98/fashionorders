"use client";
// Frontend: remembers the last products you opened in this browser.
// Nothing is sent to the server. We store only what the card needs.

export type RecentProduct = {
  id: number;
  title: string;
  brand: string;
  price_cents: number | null;
  image: string;
  saved?: boolean;
  media?: { url: string; alt?: string }[];
  variants?: { price_cents: number | null; color?: string }[];
  created_at?: string;
};

const KEY = "fo_recent_products";
const LIMIT = 12;

export function rememberProduct(product: RecentProduct) {
  if (typeof window === "undefined" || !product?.id) return;
  const next = [
    product,
    ...readRecent().filter((p) => p.id !== product.id),
  ].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the shop still works without history.
  }
}

export function readRecent(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p && p.id) : [];
  } catch {
    return [];
  }
}
