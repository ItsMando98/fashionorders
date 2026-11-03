"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import { formatCny, formatEur, imgSrc } from "@/components/shop/format";
import type { CartLine, OrderTotals } from "@/lib/types";

export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [totals, setTotals] = useState<OrderTotals | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) return;
      const data = await res.json();
      setLines(data.lines || []);
      setTotals(data.totals || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateLine = async (id: number, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/cart/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setLines(data.lines || []);
      setTotals(data.totals || null);
    }
  };

  const removeLine = async (id: number) => {
    const res = await fetch(`/api/cart/${id}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      setLines(data.lines || []);
      setTotals(data.totals || null);
    }
  };

  return (
    <ShopShell>
      <div className="space-y-6">
        <h1 className="font-display italic font-bold text-3xl">YOUR CART</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : lines.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link href="/shop" className="text-primary underline text-sm">
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="flex gap-4 p-3 rounded-lg border border-border bg-card"
                >
                  <Link
                    href={`/shop/product/${line.product_id}`}
                    className="w-20 h-20 rounded-md bg-secondary overflow-hidden shrink-0"
                  >
                    {imgSrc(line.local_image) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgSrc(line.local_image)}
                        alt={line.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        No img
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{line.brand}</p>
                    <p className="text-sm font-medium line-clamp-1">{line.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Size: {line.chosen_size || "—"} · {formatCny(line.price_cny)} ·{" "}
                      {formatEur(line.final_unit_eur)} / item
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateLine(line.id, { quantity: line.quantity - 1 })}
                        disabled={line.quantity <= 1}
                        className="w-7 h-7 rounded border border-border bg-background disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="text-sm w-6 text-center">{line.quantity}</span>
                      <button
                        onClick={() => updateLine(line.id, { quantity: line.quantity + 1 })}
                        className="w-7 h-7 rounded border border-border bg-background"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <p className="font-semibold text-primary">{formatEur(line.line_total_eur)}</p>
                    <button
                      onClick={() => removeLine(line.id)}
                      className="text-muted-foreground hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totals && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2 sticky top-20">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Order summary
                </h2>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items ({totals.items_count})</span>
                  <span>{formatEur(totals.base_eur_sum)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base (CNY)</span>
                  <span>{formatCny(totals.subtotal_cny)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item service fees</span>
                  <span>{formatEur(totals.item_fees_eur)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Order handling (+{totals.haul_fee_percent}%)
                  </span>
                  <span>{formatEur(totals.haul_fee_eur)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{totals.shipping_eur > 0 ? formatEur(totals.shipping_eur) : "Free"}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-primary">{formatEur(totals.total_eur)}</span>
                </div>
                <Link
                  href="/checkout"
                  className="block text-center mt-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
                >
                  Proceed to checkout
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </ShopShell>
  );
}
