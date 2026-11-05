"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { eur } from "@/components/commerce/client";

export function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<any[]>([]);
  const box = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(
        `/api/commerce/products?per_page=24&search=${encodeURIComponent(q.trim())}`,
        { cache: "no-store" },
      )
        .then((r) => r.json())
        .then((d) => setHits((d.products || []).slice(0, 6)))
        .catch(() => setHits([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const hide = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", hide);
    return () => document.removeEventListener("mousedown", hide);
  }, []);
  return (
    <form
      ref={box}
      className="relative hidden min-w-0 flex-1 md:block"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const next = q.trim();
        setOpen(false);
        router.push(next ? `/shop?search=${encodeURIComponent(next)}` : "/shop");
      }}
    >
      <label className="sr-only" htmlFor="shop-search">
        Produkte suchen
      </label>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id="shop-search"
        className="commerce-header-search"
        placeholder="Marke oder Produkt suchen"
        value={q}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && hits.length > 0 && (
        <ul className="commerce-suggest" role="listbox">
          {hits.map((p) => (
            <li key={p.id}>
              <Link
                href={`/shop/product/${p.id}`}
                className="flex items-center gap-3 px-3 py-2 hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                {p.media?.[0] ? (
                  <img
                    src={`${p.media[0].url}?w=240`}
                    alt=""
                    className="h-12 w-10 object-cover"
                  />
                ) : (
                  <span className="h-12 w-10 bg-secondary" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.brand} · {eur(p.variants?.[0]?.price_cents)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="submit"
              className="w-full px-3 py-2 text-left text-xs underline"
            >
              Alle Treffer zu „{q}“ anzeigen
            </button>
          </li>
        </ul>
      )}
    </form>
  );
}
