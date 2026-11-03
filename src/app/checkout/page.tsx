"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Copy } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import { formatEur } from "@/components/shop/format";
import type { CartLine, OrderTotals, ShopOrder, ShopSettings } from "@/lib/types";

type CryptoCurrency = "BTC" | "ETH" | "USDT";

export default function CheckoutPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [totals, setTotals] = useState<OrderTotals | null>(null);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    ship_name: "",
    ship_street: "",
    ship_zip: "",
    ship_city: "",
    ship_country: "",
  });
  const [currency, setCurrency] = useState<CryptoCurrency>("BTC");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<ShopOrder | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cartRes, settingsRes] = await Promise.all([
        fetch("/api/cart"),
        fetch("/api/shop/settings"),
      ]);
      if (cartRes.ok) {
        const data = await cartRes.json();
        setLines(data.lines || []);
        setTotals(data.totals || null);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.shop_settings);
        // Erste verfuegbare Waehrung vorauswaehlen
        const s: ShopSettings = data.shop_settings;
        if (s.crypto_btc_address) setCurrency("BTC");
        else if (s.crypto_eth_address) setCurrency("ETH");
        else if (s.crypto_usdt_address) setCurrency("USDT");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addressFor = (cur: CryptoCurrency): string => {
    if (!settings) return "";
    return cur === "BTC"
      ? settings.crypto_btc_address
      : cur === "ETH"
        ? settings.crypto_eth_address
        : settings.crypto_usdt_address;
  };

  const available = (cur: CryptoCurrency) => Boolean(addressFor(cur));

  const placeOrder = async () => {
    setPlacing(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, crypto_currency: currency }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Checkout failed.");
        return;
      }
      const order: ShopOrder = data.order;
      setPlacedOrder(order);
      // QR-Code fuer die Wallet-Adresse erzeugen
      try {
        const uri =
          order.crypto_currency === "BTC"
            ? `bitcoin:${order.crypto_address}`
            : `ethereum:${order.crypto_address}`;
        setQrDataUrl(await QRCode.toDataURL(uri, { width: 220, margin: 1 }));
      } catch {
        /* QR optional */
      }
    } finally {
      setPlacing(false);
    }
  };

  const copyAddress = async () => {
    if (!placedOrder) return;
    try {
      await navigator.clipboard.writeText(placedOrder.crypto_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  // ---- Erfolgs-Ansicht: Zahlungsanweisung ----
  if (placedOrder) {
    return (
      <ShopShell>
        <div className="max-w-xl mx-auto space-y-6 text-center py-8">
          <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto" />
          <h1 className="font-display italic font-bold text-3xl">ORDER PLACED</h1>
          <p className="text-muted-foreground">
            Order <span className="font-mono text-foreground">{placedOrder.order_number}</span> is
            reserved. Send the equivalent of{" "}
            <span className="font-semibold text-primary">{formatEur(placedOrder.total_eur)}</span>{" "}
            in {placedOrder.crypto_currency} to:
          </p>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Wallet QR code" className="mx-auto rounded-md bg-white p-2" />
            )}
            <div className="flex items-center gap-2 justify-center">
              <code className="text-sm break-all font-mono bg-background px-3 py-2 rounded border border-border">
                {placedOrder.crypto_address}
              </code>
              <button
                onClick={copyAddress}
                className="p-2 rounded-md border border-border hover:border-primary/60"
                title="Copy address"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              After sending, paste your transaction hash on the order page. We confirm your payment
              manually and start ordering from our supplier.
            </p>
          </div>

          <Link
            href={`/orders/${placedOrder.id}`}
            className="inline-block px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            View order & submit TX hash
          </Link>
        </div>
      </ShopShell>
    );
  }

  // ---- Checkout-Formular ----
  return (
    <ShopShell>
      <div className="space-y-6">
        <h1 className="font-display italic font-bold text-3xl">CHECKOUT</h1>

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
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Shipping address
                </h2>
                {(
                  [
                    ["ship_name", "Full name"],
                    ["ship_street", "Street & number"],
                    ["ship_zip", "ZIP code"],
                    ["ship_city", "City"],
                    ["ship_country", "Country"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <input
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Payment — Crypto
                </h2>
                <div className="flex gap-2">
                  {(["BTC", "ETH", "USDT"] as const).map((cur) => (
                    <button
                      key={cur}
                      onClick={() => available(cur) && setCurrency(cur)}
                      disabled={!available(cur)}
                      className={`flex-1 px-4 py-3 rounded-md border text-sm font-medium ${
                        currency === cur && available(cur)
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      } ${!available(cur) ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      {cur}
                      {!available(cur) && <span className="block text-xs">unavailable</span>}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  You will receive the wallet address and exact amount after placing the order.
                  Payment is confirmed manually.
                </p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            {totals && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2 sticky top-20">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Summary
                </h2>
                {lines.map((l) => (
                  <div key={l.id} className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground line-clamp-1">
                      {l.quantity}× {l.title}
                    </span>
                    <span className="shrink-0">{formatEur(l.line_total_eur)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order handling (+{totals.haul_fee_percent}%)</span>
                    <span>{formatEur(totals.haul_fee_eur)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{totals.shipping_eur > 0 ? formatEur(totals.shipping_eur) : "Free"}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1">
                    <span>Total</span>
                    <span className="text-primary">{formatEur(totals.total_eur)}</span>
                  </div>
                </div>
                <button
                  onClick={placeOrder}
                  disabled={placing}
                  className="w-full mt-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {placing ? "Placing order…" : "Place order"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </ShopShell>
  );
}
