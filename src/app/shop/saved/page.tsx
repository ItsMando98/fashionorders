"use client";
import Link from "next/link";
import { ShopShell } from "@/components/shop/shell";
import { useData, Notice } from "@/components/commerce/client";
import {
  ProductCard,
  ProductSkeleton,
} from "@/components/shop/product-card";

export default function SavedPage() {
  const { data, error, loading, reload } = useData(
    "products?scope=saved&per_page=48",
  );
  return (
    <ShopShell>
      <header className="mb-8">
        <p className="commerce-eyebrow">Merkliste</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Gespeichert</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data?.total ?? 0}{" "}
          {(data?.total ?? 0) === 1 ? "Produkt" : "Produkte"} für später
        </p>
      </header>
      <Notice error={error} />
      {loading ? (
        <div
          role="status"
          className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : data?.products.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {data.products.map((p: any) => (
            <ProductCard key={p.id} product={p} onChange={() => void reload()} />
          ))}
        </div>
      ) : (
        <div className="commerce-empty">
          <h2>Deine Merkliste ist leer</h2>
          <p>Tippe auf das Herz an einem Produkt, um es hier zu sammeln.</p>
          <Link className="commerce-button" href="/shop">
            Produkte entdecken
          </Link>
        </div>
      )}
    </ShopShell>
  );
}
