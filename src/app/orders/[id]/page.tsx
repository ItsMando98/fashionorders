"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, CheckCircle2, Copy } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import {
  formatCny,
  formatEur,
  imgSrc,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from "@/components/shop/format";
import type { ShopOrder } from "@/lib/types";

const STATUS_FLOW = ["awaiting_payment", "paid", "ordering", "shipped", "delivered"];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [txid, setTxid] = useState("");
  const [savingTxid, setSavingTxid] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        setError("Order not found.");
        return;
      }
      const data = await res.json();
      setOrder(data.order);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      if (order?.crypto_address && order.status === "awaiting_payment") {
        try {
          const uri =
            order.crypto_currency === "BTC"
              ? `bitcoin:${order.crypto_address}`
              : `ethereum:${order.crypto_address}`;
          setQrDataUrl(await QRCode.toDataURL(uri, { width: 180, margin: 1 }));
        } catch {
          /* optional */
        }
      }
    })();
  }, [order]);

  const submitTxid = async () => {
    if (!txid.trim()) return;
    setSavingTxid(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/txid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txid: txid.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrder(data.order);
        setTxid("");
      } else {
        setError(data.detail || "Could not save TX hash.");
      }
    } finally {
      setSavingTxid(false);
    }
  };

  const copyAddress = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.crypto_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const currentStep = order ? STATUS_FLOW.indexOf(order.status) : -1;

  return (
    <ShopShell>
      <div className="space-y-6">
        <button
          onClick={() => router.push("/orders")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </button>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !order ? (
          <p className="text-muted-foreground">{error || "Order not found."}</p>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-display italic font-bold text-3xl font-mono">{order.order_number}</h1>
                <p className="text-sm text-muted-foreground">{order.created_at}</p>
              </div>
              <span
                className={`text-sm px-3 py-1.5 rounded-full border ${
                  ORDER_STATUS_COLORS[order.status] || "bg-secondary text-muted-foreground border-border"
                }`}
              >
                {ORDER_STATUS_LABELS[order.status] || order.status}
              </span>
            </div>

            {/* Status-Timeline */}
            {order.status !== "cancelled" && (
              <div className="flex items-center gap-1">
                {STATUS_FLOW.map((step, i) => (
                  <div key={step} className="flex-1">
                    <div
                      className={`h-1.5 rounded-full ${
                        i <= currentStep ? "bg-primary" : "bg-secondary"
                      }`}
                    />
                    <p
                      className={`text-[10px] mt-1 uppercase tracking-wide ${
                        i <= currentStep ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[step]}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Zahlungs-Box (solange unbezahlt) */}
            {order.status === "awaiting_payment" && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
                <h2 className="font-semibold">Payment required</h2>
                <p className="text-sm text-muted-foreground">
                  Send the equivalent of{" "}
                  <span className="font-semibold text-primary">{formatEur(order.total_eur)}</span> in{" "}
                  {order.crypto_currency} to:
                </p>
                <div className="flex items-start gap-4 flex-wrap">
                  {qrDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="Wallet QR" className="rounded-md bg-white p-1.5" />
                  )}
                  <div className="space-y-2 flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <code className="text-xs break-all font-mono bg-background px-3 py-2 rounded border border-border flex-1">
                        {order.crypto_address}
                      </code>
                      <button
                        onClick={copyAddress}
                        className="p-2 rounded-md border border-border hover:border-primary/60"
                      >
                        {copied ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={txid}
                        onChange={(e) => setTxid(e.target.value)}
                        placeholder="Paste your transaction hash (TXID)…"
                        className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                      />
                      <button
                        onClick={submitTxid}
                        disabled={savingTxid || !txid.trim()}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                      >
                        {savingTxid ? "Saving…" : "Submit"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {order.crypto_txid && (
              <p className="text-xs text-muted-foreground font-mono">
                TXID: {order.crypto_txid}
              </p>
            )}

            {/* Positionen */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Item</th>
                    <th className="p-3 font-medium">Size</th>
                    <th className="p-3 font-medium text-center">Qty</th>
                    <th className="p-3 font-medium text-right">CNY</th>
                    <th className="p-3 font-medium text-right">Fee</th>
                    <th className="p-3 font-medium text-right">Total</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-secondary overflow-hidden shrink-0">
                            {imgSrc(item.local_image) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgSrc(item.local_image)}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <span className="line-clamp-2">{item.title}</span>
                        </div>
                      </td>
                      <td className="p-3">{item.chosen_size || "—"}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">{formatCny(item.price_cny)}</td>
                      <td className="p-3 text-right">{formatEur(item.fee_eur)}</td>
                      <td className="p-3 text-right font-medium">{formatEur(item.line_total_eur)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{item.fulfillment_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals + Adresse */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Totals
                </h2>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatEur(order.subtotal_eur)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base (CNY)</span>
                  <span>{formatCny(order.subtotal_cny)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order handling (+{order.haul_fee_percent}%)</span>
                  <span>{formatEur(order.haul_fee_eur)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{order.shipping_eur > 0 ? formatEur(order.shipping_eur) : "Free"}</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-primary">{formatEur(order.total_eur)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 space-y-1">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Shipping to
                </h2>
                <p className="text-sm">{order.ship_name}</p>
                <p className="text-sm text-muted-foreground">
                  {order.ship_street}
                  <br />
                  {order.ship_zip} {order.ship_city}
                  <br />
                  {order.ship_country}
                </p>
                {order.tracking_number && (
                  <p className="text-sm pt-1">
                    Tracking: <span className="font-mono">{order.tracking_number}</span>
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ShopShell>
  );
}
