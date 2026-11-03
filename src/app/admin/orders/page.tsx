"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import {
  formatCny,
  formatEur,
  imgSrc,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from "@/components/shop/format";
import type { AdminShopOrder } from "@/lib/types";

const STATUSES = ["awaiting_payment", "paid", "ordering", "shipped", "delivered", "cancelled"];

interface SellerGroup {
  seller: string;
  total_cny: number;
  items: { id: number; title: string; chosen_size: string; quantity: number; price_cny: number | null; source_url: string; weidian_url: string }[];
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sellerSheet, setSellerSheet] = useState<{ orderId: number; groups: SellerGroup[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.status === 403) {
        setError("Admin access required.");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchOrder = async (id: number, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) load();
  };

  const openSellerSheet = async (orderId: number) => {
    const res = await fetch(`/api/admin/orders/${orderId}/seller-sheet`);
    if (!res.ok) return;
    const data = await res.json();
    setSellerSheet({ orderId, groups: data.seller_groups || [] });
  };

  return (
    <ShopShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display italic font-bold text-3xl">ALL ORDERS</h1>
            <p className="text-muted-foreground text-sm">
              Confirm payments, manage fulfillment, forward positions to sellers
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm hover:border-primary/60"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground text-center py-20">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg border border-border bg-card">
                {/* Kopfzeile */}
                <div className="flex items-center justify-between gap-3 p-4 flex-wrap">
                  <button
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    className="text-left"
                  >
                    <p className="font-mono font-medium">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.user_name} · {order.created_at} · {order.items?.length ?? 0} items
                    </p>
                  </button>
                  <div className="flex items-center gap-2 flex-wrap">
                    {order.crypto_txid && (
                      <span className="text-xs font-mono text-muted-foreground">
                        TX: {order.crypto_txid.slice(0, 10)}…
                      </span>
                    )}
                    {order.status === "awaiting_payment" && (
                      <button
                        onClick={() => patchOrder(order.id, { confirm_payment: true })}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:opacity-90"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirm payment
                      </button>
                    )}
                    <select
                      value={order.status}
                      onChange={(e) => patchOrder(order.id, { status: e.target.value })}
                      className={`text-xs px-2 py-1.5 rounded-md border bg-background ${
                        ORDER_STATUS_COLORS[order.status] || "border-border"
                      }`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {ORDER_STATUS_LABELS[s] || s}
                        </option>
                      ))}
                    </select>
                    <span className="font-semibold text-primary">{formatEur(order.total_eur)}</span>
                  </div>
                </div>

                {/* Detail aufklappbar */}
                {expanded === order.id && (
                  <div className="border-t border-border p-4 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Ship to</p>
                        <p>{order.ship_name}</p>
                        <p className="text-muted-foreground">
                          {order.ship_street}, {order.ship_zip} {order.ship_city}, {order.ship_country}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Payment</p>
                        <p>
                          {formatEur(order.total_eur)} via {order.crypto_currency}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground break-all">
                          {order.crypto_address}
                        </p>
                        {order.crypto_txid && (
                          <p className="text-xs font-mono break-all">TXID: {order.crypto_txid}</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="p-2 font-medium">Item</th>
                            <th className="p-2 font-medium">Size</th>
                            <th className="p-2 font-medium text-center">Qty</th>
                            <th className="p-2 font-medium text-right">CNY</th>
                            <th className="p-2 font-medium text-right">EUR</th>
                            <th className="p-2 font-medium">Seller</th>
                            <th className="p-2 font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.items || []).map((item) => (
                            <tr key={item.id} className="border-b border-border/50 last:border-0">
                              <td className="p-2">
                                <div className="flex items-center gap-2 min-w-[180px]">
                                  <div className="w-8 h-8 rounded bg-secondary overflow-hidden shrink-0">
                                    {imgSrc(item.local_image) && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={imgSrc(item.local_image)} alt={item.title} className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                  <span className="line-clamp-1">{item.title}</span>
                                </div>
                              </td>
                              <td className="p-2">{item.chosen_size || "—"}</td>
                              <td className="p-2 text-center">{item.quantity}</td>
                              <td className="p-2 text-right">{formatCny(item.price_cny)}</td>
                              <td className="p-2 text-right">{formatEur(item.line_total_eur)}</td>
                              <td className="p-2 font-mono text-xs">{item.seller || "—"}</td>
                              <td className="p-2">
                                {item.source_url && (
                                  <a href={item.source_url} target="_blank" rel="noreferrer" className="text-primary text-xs underline">
                                    Open ↗
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <input
                        defaultValue={order.tracking_number}
                        placeholder="Tracking number…"
                        onBlur={(e) => {
                          if (e.target.value !== order.tracking_number) {
                            patchOrder(order.id, { tracking_number: e.target.value });
                          }
                        }}
                        className="px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary font-mono w-64"
                      />
                      <button
                        onClick={() => openSellerSheet(order.id)}
                        className="px-4 py-2 rounded-md border border-border text-sm hover:border-primary/60"
                      >
                        Seller sheet
                      </button>
                      <a
                        href={`/api/admin/orders/${order.id}/seller-sheet?format=xlsx`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                      >
                        <Download className="h-4 w-4" /> Excel for sellers
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Seller-Sheet Dialog */}
        {sellerSheet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSellerSheet(null)}>
            <div
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border border-border bg-card p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-semibold">Seller sheet — grouped by seller</h2>
              {sellerSheet.groups.map((group) => (
                <div key={group.seller} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="font-mono font-medium">{group.seller}</p>
                    <p className="text-sm text-muted-foreground">{formatCny(group.total_cny)}</p>
                  </div>
                  {group.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2 text-sm border-t border-border/50 pt-2">
                      <span className="line-clamp-1 flex-1">
                        {item.quantity}× {item.title} ({item.chosen_size || "—"})
                      </span>
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noreferrer" className="text-primary text-xs underline shrink-0">
                          Yupoo ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <button
                onClick={() => setSellerSheet(null)}
                className="w-full px-4 py-2 rounded-md border border-border text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </ShopShell>
  );
}
