"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, ShoppingBag, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import {
  useData,
  api,
  eur,
  Notice,
  Loading,
} from "@/components/commerce/client";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductDetails } from "@/components/shop/product-details";
import { ProductRail } from "@/components/shop/product-card";
import { colorHex } from "@/components/shop/colors";
import { rememberProduct, readRecent } from "@/components/shop/recent";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { categories } from "@/lib/commerce/taxonomy";

export default function ProductPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useData(`products/${id}`);
  const session = useData("session");
  const [size, setSize] = useState(""),
    [color, setColor] = useState(""),
    [qty, setQty] = useState(1),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState(""),
    [chart, setChart] = useState(false),
    [related, setRelated] = useState<any[]>([]),
    [recent, setRecent] = useState<any[]>([]);
  const p = data?.product;
  useEffect(() => {
    if (
      data?.redirect_product_id &&
      String(data.redirect_product_id) !== String(id)
    )
      window.history.replaceState(
        null,
        "",
        `/shop/product/${data.redirect_product_id}`,
      );
  }, [data?.redirect_product_id, id]);
  useEffect(() => {
    setSize("");
    setColor("");
  }, [id]);
  useEffect(() => {
    if (p) document.title = p.listing?.seo_title || p.title;
  }, [p]);
  const listing = p?.listing || {};
  const v = p?.variants.find((x: any) => x.size === size && x.color === color);
  const display =
    v || p?.variants.find((x: any) => x.price_cents !== null) || p?.variants[0];
  const colors = [
    ...new Set<string>(p?.variants.map((x: any) => x.color) || []),
  ];
  const sizes = [
    ...new Set<string>(p?.variants.map((x: any) => x.size) || []),
  ];
  useEffect(() => {
    if (colors.length === 1 && color !== colors[0]) setColor(colors[0]);
  }, [colors.join("|"), color]);
  useEffect(() => {
    if (sizes.length === 1 && size !== sizes[0]) setSize(sizes[0]);
  }, [sizes.join("|"), size]);
  const colorImage = (name: string) => {
    const ids = (p?.variants || [])
      .filter((x: any) => x.color === name)
      .map((x: any) => x.id);
    return (
      p?.media.find(
        (m: any) => m.kind !== "size_chart" && ids.includes(m.variant_id),
      ) || p?.media.find((m: any) => m.kind !== "size_chart")
    );
  };
  const sizeChart = p?.media.find((m: any) => m.kind === "size_chart");
  const byId = Object.fromEntries(categories.map((c) => [c[0], c]));
  const leaf = (p?.category_ids || [])
    .map((cid: string) => byId[cid])
    .find(Boolean);
  const trail: (typeof categories)[number][] = [];
  let node = leaf as (typeof categories)[number] | undefined;
  while (node) {
    trail.unshift(node);
    node = node[1] ? (byId[node[1]] as (typeof categories)[number]) : undefined;
  }
  useEffect(() => {
    if (!p) return;
    rememberProduct({
      id: p.id,
      title: p.title,
      brand: p.brand,
      price_cents: display?.price_cents ?? null,
      image: p.media[0]?.url || "",
      media: p.media,
      variants: p.variants,
      saved: p.saved,
      created_at: p.created_at,
    });
    setRecent(readRecent().filter((x) => x.id !== p.id).slice(0, 5));
    const cat = p.category_ids?.[0] || "";
    const q = new URLSearchParams({
      per_page: "24",
      exclude: String(p.id),
    });
    if (cat) q.set("category", cat);
    else if (p.gender) q.set("gender", p.gender);
    fetch(`/api/commerce/products?${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRelated((d.products || []).slice(0, 10)))
      .catch(() => setRelated([]));
  }, [p?.id]);
  async function add() {
    if (!v) return;
    setBusy(true);
    setFailure("");
    try {
      await api("cart", { variant_id: v.id, quantity: qty });
      setMessage(
        "In deinem Warenkorb. Du kannst die Auswahl anschließend zur Prüfung einreichen.",
      );
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ShopShell>
      <nav className="mb-6 text-xs text-muted-foreground" aria-label="Brotkrumen">
        <Link href="/shop">Shop</Link>
        {trail.map((c) => (
          <span key={c[0]}>
            <span aria-hidden> / </span>
            <Link href={`/shop?category=${c[0]}`}>{c[2]}</Link>
          </span>
        ))}
        {p && (
          <>
            <span aria-hidden> / </span>
            <span className="text-foreground">{p.title}</span>
          </>
        )}
      </nav>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : (
        p && (
          <>
            <div className="grid gap-8 pb-24 md:grid-cols-2 lg:gap-16 md:pb-0">
              <ProductGallery
                title={p.title}
                media={p.media}
                variantIds={(p.variants || [])
                  .filter((x: any) => x.color === color)
                  .map((x: any) => x.id)}
              />
              <section className="self-start md:sticky md:top-24">
                <p className="commerce-eyebrow">
                  {p.brand}
                  {p.visibility === "private" ? " · Dein privater Import" : ""}
                </p>
                <h1 className="mt-2 font-display text-3xl leading-tight lg:text-4xl">
                  {p.title}
                </h1>
                <p className="mt-4 text-2xl" title="Vorläufiger Kundenpreis">
                  {eur(display?.price_cents)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vorläufiger Preis inkl. MwSt. Versand und Gesamtbetrag
                  erhältst du nach unserer Prüfung.
                </p>
                {listing.tagline && (
                  <p className="mt-4 max-w-md text-sm leading-6">
                    {listing.tagline}
                  </p>
                )}
                <div className="mt-8 space-y-6">
                  {colors.length > 0 && (
                    <fieldset>
                      <legend className="mb-3 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
                        Farbe: {color || "Bitte auswählen"}
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((c) => {
                          const img = colorImage(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              className={`overflow-hidden border ${color === c ? "border-foreground" : "border-border"}`}
                              aria-pressed={color === c}
                              aria-label={c || "Laut Produktabbildung"}
                              onClick={() => {
                                setColor(c);
                                setSize("");
                              }}
                            >
                              {img ? (
                                <img
                                  src={`${img.url}?w=240`}
                                  alt=""
                                  className="h-16 w-16 object-cover"
                                />
                              ) : (
                                <span
                                  className="block h-16 w-16"
                                  style={{
                                    background:
                                      colorHex(c) || "hsl(var(--muted))",
                                  }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="size-select" className="text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
                        Größe
                      </label>
                      {sizeChart && (
                        <button
                          type="button"
                          className="text-xs underline"
                          onClick={() => setChart(true)}
                        >
                          Größentabelle
                        </button>
                      )}
                    </div>
                    <select
                      id="size-select"
                      className="commerce-input w-full"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                    >
                      <option value="">Bitte auswählen</option>
                      {sizes.map((s) => {
                        const match = p.variants.find(
                          (x: any) => x.size === s && x.color === color,
                        );
                        const blocked =
                          !match || match.availability === "unavailable";
                        return (
                          <option key={s} value={s} disabled={blocked}>
                            {s || "Einheitsgröße"}
                            {blocked ? " — nicht lieferbar" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {v?.availability === "review" && (
                    <p className="text-sm text-muted-foreground">
                      Größe und Verfügbarkeit werden vor deinem Angebot
                      bestätigt.
                    </p>
                  )}
                  <label className="commerce-field max-w-24">
                    Menge
                    <input
                      className="commerce-input"
                      type="number"
                      min="1"
                      max="99"
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                    />
                  </label>
                  <div className="hidden gap-2 md:flex">
                    <button
                      className="commerce-button flex-1"
                      disabled={!v || busy || v.availability === "unavailable"}
                      onClick={add}
                    >
                      <ShoppingBag size={17} />
                      {busy ? "Wird hinzugefügt …" : "In den Warenkorb"}
                    </button>
                    <button
                      className="commerce-button secondary"
                      aria-label={p.saved ? "Gemerkt" : "Für später speichern"}
                      onClick={async () => {
                        try {
                          await api(
                            "saved",
                            { product_id: p.id },
                            p.saved ? "DELETE" : "POST",
                          );
                          await reload();
                        } catch (e) {
                          setFailure((e as Error).message);
                        }
                      }}
                    >
                      <Heart
                        size={16}
                        fill={p.saved ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                  <Notice error={failure} text={message} />
                  <ul className="commerce-trust">
                    <li>
                      <Truck size={16} /> Direktversand vom Lieferanten
                    </li>
                    <li>
                      <ShieldCheck size={16} /> Zahlung erst nach geprüftem
                      Angebot
                    </li>
                    <li>
                      <RotateCcw size={16} />{" "}
                      {session.data?.tax_note ||
                        "Verbindlicher Preis nach Prüfung"}
                    </li>
                  </ul>
                </div>
                <ProductDetails
                  product={p}
                  listing={listing}
                  taxNote={session.data?.tax_note}
                />
                {p.import_url && (
                  <details className="mt-6 border border-border p-4">
                    <summary className="cursor-pointer text-sm">
                      Eigenen Import ergänzen
                    </summary>
                    <form
                      className="mt-4 space-y-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        try {
                          await api(
                            `products/${p.id}/draft`,
                            {
                              title: f.get("title"),
                              size: f.get("size"),
                              color: f.get("color"),
                              notes: f.get("notes"),
                            },
                            "PATCH",
                          );
                          await reload();
                          setMessage(
                            "Import ergänzt. Wähle deine gewünschte Variante aus.",
                          );
                        } catch (e) {
                          setFailure((e as Error).message);
                        }
                      }}
                    >
                      <label className="commerce-field">
                        Titel
                        <input
                          className="commerce-input"
                          name="title"
                          defaultValue={p.title}
                          required
                        />
                      </label>
                      <label className="commerce-field">
                        Gewünschte Größe
                        <input
                          className="commerce-input"
                          name="size"
                          placeholder="z. B. M oder EU 42"
                          required
                        />
                      </label>
                      <label className="commerce-field">
                        Gewünschte Farbe
                        <input className="commerce-input" name="color" />
                      </label>
                      <label className="commerce-field">
                        Deine Notiz
                        <textarea
                          className="commerce-input"
                          name="notes"
                          defaultValue={p.notes || ""}
                        />
                      </label>
                      <button className="commerce-button secondary">
                        Privaten Import ergänzen
                      </button>
                    </form>
                    <a
                      href={p.import_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-xs underline"
                    >
                      Deine Importquelle öffnen
                    </a>
                  </details>
                )}
              </section>
            </div>
            <div className="mt-16 space-y-16">
              <ProductRail
                title="Das könnte dir auch gefallen"
                products={related}
              />
              <ProductRail
                title="Zuletzt angesehen"
                products={recent}
                empty=""
              />
            </div>
            {sizeChart && (
              <Dialog open={chart} onOpenChange={setChart}>
                <DialogContent className="max-w-3xl">
                  <DialogTitle>Größentabelle</DialogTitle>
                  <img
                    src={sizeChart.url}
                    alt={sizeChart.alt || "Größentabelle"}
                    className="w-full object-contain"
                  />
                </DialogContent>
              </Dialog>
            )}
            <div className="commerce-buybar md:hidden">
              <div>
                <p className="text-sm font-medium">{eur(display?.price_cents)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {color || size ? [color, size].filter(Boolean).join(" · ") : "Farbe und Größe wählen"}
                </p>
              </div>
              <button
                className="commerce-button"
                disabled={!v || busy || v.availability === "unavailable"}
                onClick={add}
              >
                In den Warenkorb
              </button>
            </div>
          </>
        )
      )}
    </ShopShell>
  );
}
