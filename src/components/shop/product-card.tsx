"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { api, eur, Notice } from "@/components/commerce/client";
import { colorHex, isNewArrival, uniqueColors } from "./colors";

type Product = Record<string, any>;

export function ProductCard({
  product: p,
  onChange,
}: {
  product: Product;
  onChange?: () => void;
}) {
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(!!p.saved),
    [busy, setBusy] = useState(false);
  const photos = (p.media || []).filter(
    (m: Product) => m.kind !== "size_chart",
  );
  const cover = photos[0];
  const hover = photos[1];
  const v =
    p.variants
      ?.filter((x: Product) => x.price_cents != null)
      .sort((a: Product, b: Product) => a.price_cents - b.price_cents)[0] ||
    p.variants?.[0];
  const colors = uniqueColors(p.variants);
  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await api("saved", { product_id: p.id }, saved ? "DELETE" : "POST");
      setSaved(!saved);
      onChange?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="commerce-product group">
      <div className="relative">
        <Link
          href={`/shop/product/${p.id}`}
          className="relative block aspect-[3/4] overflow-hidden bg-secondary"
        >
          {cover ? (
            <>
              <img
                src={`${cover.url}?w=640`}
                srcSet={`${cover.url}?w=240 240w, ${cover.url}?w=640 640w, ${cover.url} 1600w`}
                sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 18vw"
                alt={cover.alt || p.title}
                loading="lazy"
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover ${hover ? "transition-opacity duration-300 group-hover:opacity-0" : ""}`}
              />
              {hover && (
                <img
                  src={`${hover.url}?w=640`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Bild in Vorbereitung
            </div>
          )}
        </Link>
        <button
          className="commerce-save"
          aria-label={saved ? "Aus Merkliste entfernen" : "Produkt merken"}
          aria-pressed={saved}
          disabled={busy}
          onClick={toggle}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
        </button>
        {isNewArrival(p.created_at) && (
          <span className="commerce-badge">Neu</span>
        )}
        {p.visibility === "private" && (
          <span className="commerce-badge commerce-badge-private">
            Privater Import
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 pt-2.5">
        <p className="text-[11px] uppercase tracking-[.16em] text-muted-foreground">
          {p.brand || "Fashion Supply"}
        </p>
        <Link
          href={`/shop/product/${p.id}`}
          className="line-clamp-2 text-sm font-medium leading-snug"
        >
          {p.title}
        </Link>
        <p className="text-sm" title="Vorläufiger Preis. Versand im Angebot.">
          {eur(v?.price_cents)}
        </p>
        {colors.length > 1 && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="flex -space-x-1" aria-hidden>
              {colors.slice(0, 4).map((c) => (
                <span
                  key={c}
                  className="inline-block h-3 w-3 rounded-full border border-white/20"
                  style={{ background: colorHex(c) || "hsl(var(--muted))" }}
                />
              ))}
            </span>
            Weitere Farben
          </p>
        )}
        <Notice error={error} />
      </div>
    </article>
  );
}

export function ProductSkeleton() {
  return (
    <div className="min-w-0">
      <div className="aspect-[3/4] animate-pulse bg-secondary" />
      <div className="mt-3 h-3 w-1/3 animate-pulse bg-secondary" />
      <div className="mt-2 h-4 w-4/5 animate-pulse bg-secondary" />
      <div className="mt-2 h-3 w-1/4 animate-pulse bg-secondary" />
    </div>
  );
}

export function ProductRail({
  title,
  products,
  empty,
}: {
  title: string;
  products: Product[];
  empty?: string;
}) {
  if (!products.length)
    return empty ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : null;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.slice(0, 10).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
