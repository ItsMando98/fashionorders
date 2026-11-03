"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShopShell } from "@/components/shop/shell";
import { formatEur, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/components/shop/format";
import type { ShopOrder } from "@/lib/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) return;
        const data = await res.json();
        setOrders(data.orders || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ShopShell>
      <div className="space-y-6">
        <h1 className="font-display italic font-bold text-3xl">MY ORDERS</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-muted-foreground">No orders yet.</p>
            <Link href="/shop" className="text-primary underline text-sm">
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/60 transition-colors"
              >
                <div>
                  <p className="font-mono font-medium">{order.order_number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.created_at} · {order.items?.length ?? 0} items
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      ORDER_STATUS_COLORS[order.status] || "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {ORDER_STATUS_LABELS[order.status] || order.status}
                  </span>
                  <span className="font-semibold text-primary">{formatEur(order.total_eur)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ShopShell>
  );
}
