"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import { formatCny, formatEur, imgSrc } from "@/components/shop/format";
import type { PublicProduct } from "@/lib/types";

const PAGE_SIZE = 24;

const GENDER_FILTERS = [
  { value: "", label: "All" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "unisex", label: "Unisex" },
] as const;

export default function ShopPage() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (pageToLoad: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          page_size: String(PAGE_SIZE),
        });
        if (search) params.set("search", search);
        if (gender) params.set("gender", gender);
        const res = await fetch(`/api/products?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setTotal(data.total || 0);
        setProducts((prev) => (append ? [...prev, ...(data.products || [])] : data.products || []));
      } finally {
        setLoading(false);
      }
    },
    [search, gender]
  );

  useEffect(() => {
    setPage(1);
    load(1, false);
  }, [load]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(next, true);
  };

  return (
    <ShopShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display italic font-bold text-3xl">SHOP</h1>
            <p className="text-muted-foreground text-sm">{total} products</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
            }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products or brands…"
                className="pl-8 pr-3 py-2 w-64 rounded-md bg-card border border-border text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Search
            </button>
          </form>
        </div>

        {/* Gender-Filter (KI-kategorisiert) */}
        <div className="flex gap-2 flex-wrap">
          {GENDER_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setGender(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                gender === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {products.length === 0 && !loading ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>No products yet.</p>
            <p className="text-sm mt-1">New drops are being added from our suppliers continuously.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/shop/product/${p.id}`}
                className="group rounded-lg border border-border bg-card overflow-hidden hover:border-primary/60 transition-colors"
              >
                <div className="aspect-square bg-secondary overflow-hidden">
                  {imgSrc(p.local_image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgSrc(p.local_image)}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">{p.brand}</p>
                    {p.subcategory && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground whitespace-nowrap">
                        {p.subcategory}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.title}</p>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-primary font-semibold">{formatEur(p.price_eur)}</span>
                    <span className="text-xs text-muted-foreground">{formatCny(p.price_cny)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {products.length < total && (
          <div className="text-center pt-2">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-6 py-2 rounded-md border border-border bg-card text-sm hover:border-primary/60 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </ShopShell>
  );
}
