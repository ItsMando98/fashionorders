"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, RefreshCw, Pencil, EyeOff, Eye, Play, Pause, Trash2, Clock } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import { formatCny, formatEur, imgSrc } from "@/components/shop/format";
import type { AdminProduct, ScrapeSource } from "@/lib/types";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Scrape-Formulare
  const [singleUrl, setSingleUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [scraping, setScraping] = useState(false);

  // Edit-Dialog (einfach gehalten)
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [editForm, setEditForm] = useState({ title: "", price_cny: "", brand: "", category: "", available_sizes: "", seller: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products?page_size=100&include_inactive=1");
      if (res.status === 403) {
        setError("Admin access required.");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scrapeSingle = async () => {
    if (!singleUrl.trim()) return;
    setScraping(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: singleUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Scrape failed.");
        return;
      }
      setNotice(`Product "${data.product.title}" saved to catalog.`);
      setSingleUrl("");
      load();
    } finally {
      setScraping(false);
    }
  };

  const scrapeBulk = async () => {
    const urls = bulkUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setScraping(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/scrape/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Bulk scrape failed.");
        return;
      }
      setNotice(data.message || `Added ${data.added ?? data.count} products.`);
      setBulkUrls("");
      load();
    } finally {
      setScraping(false);
    }
  };

  const openEdit = (p: AdminProduct) => {
    setEditing(p);
    setEditForm({
      title: p.title,
      price_cny: p.price_cny !== null ? String(p.price_cny) : "",
      brand: p.brand,
      category: p.category,
      available_sizes: p.available_sizes,
      seller: p.seller,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await fetch(`/api/products/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        price_cny: editForm.price_cny === "" ? null : Number(editForm.price_cny),
        brand: editForm.brand,
        category: editForm.category,
        available_sizes: editForm.available_sizes,
        seller: editForm.seller,
      }),
    });
    if (res.ok) {
      setEditing(null);
      load();
    }
  };

  const toggleActive = async (p: AdminProduct) => {
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: p.active === 1 ? 0 : 1 }),
    });
    if (res.ok) load();
  };

  // ---------- Auto-Scraper (Scrape Sources + Cron-Scheduler) ----------
  const [sources, setSources] = useState<ScrapeSource[]>([]);
  const [sourceForm, setSourceForm] = useState({
    seller_url: "",
    label: "",
    interval_hours: "24",
    per_run_limit: "20",
  });
  const [sourceSaving, setSourceSaving] = useState(false);

  const loadSources = useCallback(async () => {
    const res = await fetch("/api/admin/scrape-sources");
    if (!res.ok) return;
    const data = await res.json();
    setSources(data.sources || []);
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Solange eine Quelle laeuft, alle 5s aktualisieren (Status-Polling)
  useEffect(() => {
    if (!sources.some((s) => s.last_status === "running")) return;
    const t = setInterval(() => {
      loadSources();
      load();
    }, 5000);
    return () => clearInterval(t);
  }, [sources, loadSources, load]);

  const addSource = async () => {
    if (!sourceForm.seller_url.trim()) return;
    setSourceSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/scrape-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_url: sourceForm.seller_url.trim(),
          label: sourceForm.label.trim(),
          interval_hours: Number(sourceForm.interval_hours) || 24,
          per_run_limit: Number(sourceForm.per_run_limit) || 20,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Could not save source.");
        return;
      }
      setNotice(`Source "${data.source.label || data.source.seller_url}" added — the scheduler picks it up automatically.`);
      setSourceForm({ seller_url: "", label: "", interval_hours: "24", per_run_limit: "20" });
      loadSources();
    } finally {
      setSourceSaving(false);
    }
  };

  const toggleSource = async (s: ScrapeSource) => {
    const res = await fetch(`/api/admin/scrape-sources/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: s.active === 1 ? 0 : 1 }),
    });
    if (res.ok) loadSources();
  };

  const deleteSource = async (s: ScrapeSource) => {
    if (!window.confirm(`Remove source "${s.label || s.seller_url}"? Products stay in the catalog.`)) return;
    const res = await fetch(`/api/admin/scrape-sources/${s.id}`, { method: "DELETE" });
    if (res.ok) loadSources();
  };

  const runSource = async (s: ScrapeSource) => {
    const res = await fetch(`/api/admin/scrape-sources/${s.id}/run`, { method: "POST" });
    if (res.status === 409) {
      setError("This source is already running.");
      return;
    }
    if (res.ok) {
      setNotice(`Scrape started for "${s.label || s.seller_url}" — running in the background.`);
      // Kurz warten, damit der Status "running" sichtbar wird
      setTimeout(loadSources, 1500);
    }
  };

  return (
    <ShopShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display italic font-bold text-3xl">PRODUCT CATALOG</h1>
            <p className="text-muted-foreground text-sm">
              {total} products · seller info is only visible here, never in the shop
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm hover:border-primary/60"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* Scrape -> Katalog */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Scrape single link
            </h2>
            <div className="flex gap-2">
              <input
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                placeholder="https://seller.x.yupoo.com/albums/123…"
                className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary font-mono"
              />
              <button
                onClick={scrapeSingle}
                disabled={scraping || !singleUrl.trim()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Scrape
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Bulk scrape (one URL per line, max 20)
            </h2>
            <textarea
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              rows={2}
              placeholder={"https://…\nhttps://…"}
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary font-mono"
            />
            <button
              onClick={scrapeBulk}
              disabled={scraping || !bulkUrls.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {scraping ? "Scraping…" : "Scrape all"}
            </button>
          </div>
        </div>

        {/* Auto-Scraper: Seller-Quellen fuer den Cron-Scheduler */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div>
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Auto-scrape sources (cron scheduler)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              The scheduler runs on the server and scrapes every active source automatically at its interval.
              Products are deduplicated by source URL.
            </p>
          </div>

          {/* Neue Quelle anlegen */}
          <div className="grid sm:grid-cols-[1fr_140px_110px_110px_auto] gap-2">
            <input
              value={sourceForm.seller_url}
              onChange={(e) => setSourceForm((f) => ({ ...f, seller_url: e.target.value }))}
              placeholder="https://seller.x.yupoo.com"
              className="px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary font-mono"
            />
            <input
              value={sourceForm.label}
              onChange={(e) => setSourceForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Label (optional)"
              className="px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              min={1}
              max={720}
              value={sourceForm.interval_hours}
              onChange={(e) => setSourceForm((f) => ({ ...f, interval_hours: e.target.value }))}
              title="Interval in hours"
              placeholder="Every h"
              className="px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              min={1}
              max={200}
              value={sourceForm.per_run_limit}
              onChange={(e) => setSourceForm((f) => ({ ...f, per_run_limit: e.target.value }))}
              title="Max albums per run"
              placeholder="Limit"
              className="px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary"
            />
            <button
              onClick={addSource}
              disabled={sourceSaving || !sourceForm.seller_url.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {sourceSaving ? "Saving…" : "Add source"}
            </button>
          </div>

          {/* Quellen-Liste */}
          {sources.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-2.5 font-medium">Seller</th>
                    <th className="p-2.5 font-medium">Interval</th>
                    <th className="p-2.5 font-medium">Limit</th>
                    <th className="p-2.5 font-medium">Last run</th>
                    <th className="p-2.5 font-medium">Result</th>
                    <th className="p-2.5 font-medium">Status</th>
                    <th className="p-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className="p-2.5">
                        <div className="min-w-[180px]">
                          {s.label && <p className="font-medium">{s.label}</p>}
                          <a
                            href={s.seller_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-xs font-mono underline break-all"
                          >
                            {s.seller_url}
                          </a>
                        </div>
                      </td>
                      <td className="p-2.5 whitespace-nowrap">every {s.interval_hours}h</td>
                      <td className="p-2.5">{s.per_run_limit}</td>
                      <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {s.last_run_at ? `${s.last_run_at} UTC` : "never"}
                      </td>
                      <td className="p-2.5 text-xs max-w-[220px]">
                        <span className="line-clamp-2">{s.last_message || "—"}</span>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            s.last_status === "running"
                              ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                              : s.active === 0
                                ? "bg-secondary text-muted-foreground border-border"
                                : s.last_status === "error"
                                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {s.last_status === "running"
                            ? "running…"
                            : s.active === 0
                              ? "paused"
                              : s.last_status === "error"
                                ? "error"
                                : "active"}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => runSource(s)}
                            disabled={s.last_status === "running"}
                            className="p-1.5 rounded border border-border hover:border-primary/60 disabled:opacity-40"
                            title="Run now"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toggleSource(s)}
                            className="p-1.5 rounded border border-border hover:border-primary/60"
                            title={s.active === 1 ? "Pause auto-scrape" : "Activate auto-scrape"}
                          >
                            {s.active === 1 ? <Pause className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => deleteSource(s)}
                            className="p-1.5 rounded border border-border hover:border-red-500/60"
                            title="Remove source"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {notice && <p className="text-sm text-emerald-400">{notice}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Katalog-Tabelle (Admin-Sicht mit Seller) */}
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 font-medium">Product</th>
                  <th className="p-3 font-medium">Brand</th>
                  <th className="p-3 font-medium text-right">CNY</th>
                  <th className="p-3 font-medium text-right">EUR</th>
                  <th className="p-3 font-medium">Seller</th>
                  <th className="p-3 font-medium">Source</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="w-10 h-10 rounded bg-secondary overflow-hidden shrink-0">
                          {imgSrc(p.local_image) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgSrc(p.local_image)} alt={p.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <span className="line-clamp-2">{p.title}</span>
                      </div>
                    </td>
                    <td className="p-3">{p.brand}</td>
                    <td className="p-3 text-right">{formatCny(p.price_cny)}</td>
                    <td className="p-3 text-right">{formatEur(p.price_eur)}</td>
                    <td className="p-3 font-mono text-xs">{p.seller || "—"}</td>
                    <td className="p-3">
                      {p.source_url ? (
                        <a
                          href={p.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-xs underline"
                        >
                          Open ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          p.active === 1
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-red-500/15 text-red-400 border-red-500/30"
                        }`}
                      >
                        {p.active === 1 ? "active" : "hidden"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded border border-border hover:border-primary/60"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          className="p-1.5 rounded border border-border hover:border-primary/60"
                          title={p.active === 1 ? "Hide from shop" : "Show in shop"}
                        >
                          {p.active === 1 ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit-Dialog */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditing(null)}>
            <div
              className="w-full max-w-md rounded-lg border border-border bg-card p-5 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-semibold">Edit product #{editing.id}</h2>
              {(
                [
                  ["title", "Title"],
                  ["brand", "Brand"],
                  ["category", "Category"],
                  ["available_sizes", "Available sizes"],
                  ["price_cny", "Price CNY"],
                  ["seller", "Seller (admin only)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    value={editForm[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:border-primary"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveEdit}
                  className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-md border border-border text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ShopShell>
  );
}
