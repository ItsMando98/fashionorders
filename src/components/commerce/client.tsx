"use client";
import { useCallback, useEffect, useState, useRef } from "react";
export { ProductCard } from "@/components/shop/product-card";
export type Data = Record<string, any>;
export async function api(
  path: string,
  body?: Data,
  method = body ? "POST" : "GET",
  headers: Record<string, string> = {},
) {
  const r = await fetch(`/api/commerce/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Anfrage fehlgeschlagen.");
  window.dispatchEvent(new Event("shop:changed"));
  return d;
}
export function useData(path: string) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const r = await fetch(`/api/commerce/${path}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail);
      if (request === sequence.current) {
        setData(d);
        setError("");
      }
    } catch (e) {
      if (request === sequence.current)
        setError(e instanceof Error ? e.message : "Verbindung fehlgeschlagen.");
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}
export const eur = (n: unknown) =>
  n == null
    ? "Preis auf Anfrage"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(Number(n) / 100);
export const cny = (n: unknown) =>
  n == null
    ? ""
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "CNY",
      }).format(Number(n) / 100);
export const date = (value: string) => new Date(value).toLocaleString("de-DE");
export const labels: Record<string, string> = {
  review: "In Prüfung",
  offered: "Angebot erhalten",
  confirmed: "Angenommen",
  procurement: "Beim Lieferanten bestellt",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
  pending: "Ausstehend",
  submitted: "Zahlung eingereicht",
  exception: "Klärung erforderlich",
  expired: "Abgelaufen",
  refunded: "Erstattet",
  partially_refunded: "Teilweise erstattet",
  draft: "Entwurf",
  sent: "Übergeben",
  unavailable: "Nicht lieferbar",
  shipped: "Versendet",
  delivered: "Zugestellt",
  published: "Veröffentlicht",
  archived: "Archiviert",
  queued: "Wartet",
  running: "Import läuft",
  done: "Importiert",
  failed: "Fehlgeschlagen",
};
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`commerce-status ${["confirmed", "done", "published", "completed", "delivered"].includes(value) ? "commerce-status-ok" : ""}`}
    >
      {labels[value] || value}
    </span>
  );
}
export function Notice({ error, text }: { error?: string; text?: string }) {
  if (!error && !text) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`commerce-notice ${error ? "commerce-error" : ""}`}
    >
      {error || text}
    </p>
  );
}
export function Loading() {
  return (
    <div
      role="status"
      className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4"
    >
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="min-w-0">
          <div className="aspect-[3/4] animate-pulse bg-secondary" />
          <div className="mt-3 h-3 w-1/3 animate-pulse bg-secondary" />
          <div className="mt-2 h-4 w-4/5 animate-pulse bg-secondary" />
        </div>
      ))}
      <span className="sr-only">Wird geladen</span>
    </div>
  );
}
export function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= 24) return null;
  return (
    <nav
      aria-label="Seitennavigation"
      className="flex justify-between items-center mt-8"
    >
      <button
        className="commerce-button secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Zurück
      </button>
      <span className="text-xs text-muted-foreground">
        {page} / {Math.ceil(total / 24)}
      </span>
      <button
        className="commerce-button secondary"
        disabled={page * 24 >= total}
        onClick={() => onChange(page + 1)}
      >
        Weiter
      </button>
    </nav>
  );
}
