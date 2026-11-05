"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import { Notice } from "@/components/commerce/client";
import {
  ProductCard,
  ProductSkeleton,
} from "@/components/shop/product-card";
import { CategoryBar, FilterBar } from "@/components/shop/filter-bar";

const PER_PAGE = 48;

export default function ShopPage() {
  const [query, setQuery] = useState(""),
    [ready, setReady] = useState(false),
    [page, setPage] = useState(1),
    [items, setItems] = useState<any[]>([]),
    [meta, setMeta] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false);
  useEffect(() => {
    const sync = () => {
      setQuery(window.location.search.slice(1));
      setPage(1);
      setReady(true);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    page === 1 ? setLoading(true) : setMore(true);
    setError("");
    fetch(`/api/commerce/products?per_page=${PER_PAGE}&page=${page}&${query}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || "Katalog nicht geladen.");
        return d;
      })
      .then((d) => {
        if (cancelled) return;
        setMeta(d);
        setItems((prev) => (page === 1 ? d.products : [...prev, ...d.products]));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setMore(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, page, ready]);
  const params = new URLSearchParams(query);
  function change(key: string, value: string, extra?: Record<string, string>) {
    const q = new URLSearchParams(query);
    value ? q.set(key, value) : q.delete(key);
    if (extra)
      for (const [k, v] of Object.entries(extra)) v ? q.set(k, v) : q.delete(k);
    if (key !== "page") q.delete("page");
    const next = q.toString();
    window.history.pushState(null, "", `/shop${next ? "?" + next : ""}`);
    setItems([]);
    setPage(1);
    setQuery(next);
    if (key === "page") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.getElementById("shop-content")?.focus({ preventScroll: true });
    }
  }
  function clear() {
    window.history.pushState(null, "", "/shop");
    setQuery("");
    setPage(1);
  }
  const total = meta?.total ?? 0;
  const shown = items.length;
  return (
    <ShopShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="commerce-eyebrow">Katalog</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight md:text-4xl">
            Shop
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {total} {total === 1 ? "Produkt" : "Produkte"} · Preise vorläufig,
            Angebot nach Prüfung
          </p>
        </div>
        <Link href="/account?tab=imports" className="commerce-button secondary">
          Eigenen Link importieren <ArrowUpRight size={16} />
        </Link>
      </header>
      <CategoryBar
        categories={meta?.categories || []}
        params={params}
        onChange={change}
      />
      <div className="mt-5">
        <FilterBar
          params={params}
          facets={meta?.facets || {}}
          counts={meta?.facet_counts || {}}
          categories={meta?.categories || []}
          onChange={change}
          onClear={clear}
        />
      </div>
      <Notice error={error} />
      <section aria-label="Produkte" className="mt-8">
        {loading || !ready ? (
          <div
            role="status"
            className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
          >
            {Array.from({ length: 10 }, (_, i) => (
              <ProductSkeleton key={i} />
            ))}
            <span className="sr-only">Produkte werden geladen</span>
          </div>
        ) : shown ? (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {total > PER_PAGE && (
              <div className="mx-auto mt-12 max-w-md space-y-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Du hast {shown} von {total} Produkten angesehen
                </p>
                <div
                  className="commerce-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={shown}
                >
                  <span style={{ width: `${Math.min(100, (shown / total) * 100)}%` }} />
                </div>
                {shown < total && (
                  <button
                    className="commerce-button secondary"
                    disabled={more}
                    onClick={() => setPage((n) => n + 1)}
                  >
                    {more ? "Wird geladen …" : "Mehr laden"}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="commerce-empty">
            <h2>Keine passenden Produkte</h2>
            <p>Ändere deine Filter oder importiere einen eigenen Produktlink.</p>
            <button className="commerce-button secondary" onClick={clear}>
              Filter zurücksetzen
            </button>
          </div>
        )}
      </section>
    </ShopShell>
  );
}
