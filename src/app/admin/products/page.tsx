"use client";
import { useState } from "react";
import { ShopShell } from "@/components/shop/shell";
import {
  api,
  useData,
  Notice,
  Status,
  eur,
  Pager,
} from "@/components/commerce/client";
import Link from "next/link";
function ProductEditor({
  id,
  onClose,
  onSaved,
}: {
  id: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, error, reload } = useData(`products/${id}`),
    [failure, setFailure] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false);
  const p = data?.product;
  // Small helper: run an action, show errors in the red box and always reload afterwards.
  async function run(action: () => Promise<void>) {
    setFailure("");
    setNote("");
    try {
      await action();
      await reload();
      onSaved();
    } catch (e) {
      setFailure((e as Error).message);
    }
  }
  async function removeVariant(v: any) {
    const label = [v.color, v.size].filter(Boolean).join(" / ") || "diese Variante";
    if (
      !window.confirm(
        `„${label}" wirklich entfernen? Ungespeicherte Änderungen an den anderen Varianten gehen dabei verloren.`,
      )
    )
      return;
    await run(async () => {
      const r = await api(`products/${id}/variants/${v.id}`, undefined, "DELETE");
      if (r.hidden)
        setNote(
          `„${label}" ist schon in einer Bestellung enthalten. Sie wurde deshalb nicht gelöscht, sondern auf „Nicht lieferbar" gesetzt.`,
        );
    });
  }
  async function removeImage(m: any) {
    if (!window.confirm("Dieses Bild wirklich löschen?")) return;
    await run(async () => {
      await api(`products/${id}/media/${m.id}`, undefined, "DELETE");
    });
  }
  // Rewrites the whole gallery order/kind in one request (the backend expects the full list).
  async function saveGallery(media: any[]) {
    await run(async () => {
      await api(
        `products/${id}/gallery`,
        { media: media.map((m: any, position: number) => ({ ...m, position })) },
        "PATCH",
      );
    });
  }
  return (
    <section className="commerce-panel space-y-5">
      <div className="flex justify-between">
        <h2 className="text-xl">Produkt bearbeiten</h2>
        <button className="text-sm underline" onClick={onClose}>
          Schließen
        </button>
      </div>
      <Notice error={error || failure} text={note} />

      {p && (
        <>
          <form
            key={p.id + JSON.stringify(p.variants)}
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setFailure("");
              const f = new FormData(e.currentTarget);
              const variants = p.variants.map((v: any) => ({
                id: v.id,
                size: f.get(`size_${v.id}`),
                color: f.get(`color_${v.id}`),
                sku: f.get(`sku_${v.id}`),
                availability: f.get(`availability_${v.id}`),
                purchase_fen: f.get(`price_${v.id}`)
                  ? Math.round(Number(f.get(`price_${v.id}`)) * 100)
                  : null,
                price_approved: f.get(`approved_${v.id}`) === "on",
              }));
              try {
                await api(
                  `products/${id}`,
                  {
                    title: f.get("title"),
                    brand: f.get("brand"),
                    description: f.get("description"),
                    material: f.get("material"),
                    fit: f.get("fit"),
                    gender: f.get("gender"),
                    supplier: f.get("supplier"),
                    source_url: f.get("source_url"),
                    procurement_url: f.get("procurement_url"),
                    publication: f.get("publication"),
                    category_ids: f.getAll("categories"),
                    variants,
                  },
                  "PATCH",
                );
                await reload();
                onSaved();
              } catch (e) {
                setFailure((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid md:grid-cols-2 gap-4">
              {[
                ["title", "Titel"],
                ["brand", "Marke"],
                ["material", "Material"],
                ["fit", "Passform"],
                ["supplier", "Lieferant"],
                ["source_url", "Bild-/Produktquelle (Yupoo/Weidian)"],
                ["procurement_url", "Bestelllink (Taobao/Weidian)"],
              ].map(([key, label]) => (
                <label className="commerce-field" key={key}>
                  {label}
                  <input
                    className="commerce-input"
                    name={key}
                    required={key === "title"}
                    defaultValue={p[key] || ""}
                  />
                </label>
              ))}
              <div className="text-sm md:col-span-2 space-y-2">
                <p>
                  {p.procurement_url
                    ? "Bestelllink hinterlegt. Vor Übergabe Artikel und Variante prüfen."
                    : "Kein eindeutiger Bestelllink: bitte prüfen und oben ergänzen."}
                </p>
                {(p.procurement_links || []).map((link: string) => (
                  <a
                    key={link}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="block underline break-all"
                  >
                    {link}
                  </a>
                ))}
              </div>
              <label className="commerce-field">
                Zielgruppe
                <select
                  name="gender"
                  className="commerce-input"
                  defaultValue={p.gender || ""}
                >
                  <option value="">Unbekannt</option>
                  <option value="men">Herren</option>
                  <option value="women">Damen</option>
                  <option value="unisex">Unisex</option>
                </select>
              </label>
            </div>
            <label className="commerce-field">
              Beschreibung
              <textarea
                rows={4}
                className="commerce-input"
                name="description"
                defaultValue={p.description}
              />
            </label>
            <label className="commerce-field">
              Kategorien
              <select
                multiple
                size={7}
                className="commerce-input"
                name="categories"
                defaultValue={p.category_ids}
              >
                {data?.categories?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-4">
              <h3 className="commerce-eyebrow">Varianten und Einkaufspreise</h3>
              {p.variants.map((v: any) => (
                <div
                  key={v.id}
                  className="grid grid-cols-2 md:grid-cols-3 gap-3 border border-border p-4"
                >
                  {[
                    ["size", "Größe"],
                    ["color", "Farbe"],
                    ["sku", "Lieferanten-SKU"],
                  ].map(([key, label]) => (
                    <label className="commerce-field" key={key}>
                      {label}
                      <input
                        className="commerce-input w-full"
                        name={`${key}_${v.id}`}
                        defaultValue={v[key]}
                      />
                    </label>
                  ))}
                  <label className="commerce-field">
                    Einkauf CNY
                    <input
                      className="commerce-input w-full"
                      name={`price_${v.id}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      defaultValue={
                        v.purchase_fen ? Number(v.purchase_fen) / 100 : ""
                      }
                    />
                  </label>
                  <label className="commerce-field">
                    Verfügbarkeit
                    <select
                      className="commerce-input"
                      name={`availability_${v.id}`}
                      defaultValue={v.availability}
                    >
                      <option value="review">Prüfen</option>
                      <option value="available">Bestellbar</option>
                      <option value="unavailable">Nicht lieferbar</option>
                    </select>
                  </label>
                  <label className="text-xs flex gap-2 items-center">
                    <input
                      type="checkbox"
                      name={`approved_${v.id}`}
                      defaultChecked={v.price_approved}
                    />
                    Preis geprüft
                  </label>
                  <button
                    type="button"
                    className="text-xs underline text-left text-red-400"
                    onClick={() => removeVariant(v)}
                  >
                    Variante entfernen
                  </button>
                </div>
              ))}
              {!p.variants.length && (
                <p className="text-sm text-muted-foreground">
                  Keine Varianten. Lege unten Farben und Größen an.
                </p>
              )}
            </div>
            <label className="commerce-field">
              Veröffentlichung
              <select
                className="commerce-input"
                name="publication"
                defaultValue={p.publication}
              >
                <option value="draft">Entwurf</option>
                <option value="review">Prüfen</option>
                <option value="published">Veröffentlicht</option>
                <option value="archived">Archiviert</option>
              </select>
            </label>
            <button className="commerce-button" disabled={busy}>
              {busy ? "Wird gespeichert …" : "Produkt speichern"}
            </button>
          </form>
          <form
            className="flex flex-wrap gap-3 border-t border-border pt-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api(
                  `products/${id}`,
                  {
                    variants: [
                      {
                        size: f.get("size"),
                        color: f.get("color"),
                        sku: f.get("sku"),
                        availability: "review",
                        price_approved: false,
                      },
                    ],
                  },
                  "PATCH",
                );
                await reload();
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          >
            <input
              className="commerce-input flex-1 min-w-24"
              name="size"
              placeholder="Neue Größe"
              aria-label="Neue Größe"
            />
            <input
              className="commerce-input flex-1 min-w-24"
              name="color"
              placeholder="Farbe"
              aria-label="Farbe"
            />
            <input
              className="commerce-input flex-1 min-w-24"
              name="sku"
              placeholder="SKU"
              aria-label="SKU"
            />
            <button className="commerce-button secondary">
              Variante ergänzen
            </button>
          </form>
          <form
            className="space-y-3 border border-border p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await run(async () => {
                const r = await api(`products/${id}/variants/generate`, {
                  colors: f.get("colors"),
                  sizes: f.get("sizes"),
                  purchase_cny: f.get("purchase_cny"),
                  replace: f.get("replace") === "on",
                });
                setNote(
                  `${r.created} Variante(n) angelegt${r.hidden_in_orders ? `, ${r.hidden_in_orders} bestellte Variante(n) auf „Nicht lieferbar" gesetzt` : ""}. Bitte Preis und Verfügbarkeit prüfen.`,
                );
              });
            }}
          >
            <h3 className="commerce-eyebrow">Farben × Größen anlegen</h3>
            <p className="text-xs text-muted-foreground">
              Mit Komma trennen, zum Beispiel Farben „Schwarz, Weiß" und Größen
              „S, M, L, XL". Es entsteht jede Kombination. Neue Varianten sind
              zuerst auf „Prüfen".
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="commerce-field">
                Farben
                <input className="commerce-input w-full" name="colors" />
              </label>
              <label className="commerce-field">
                Größen
                <input className="commerce-input w-full" name="sizes" />
              </label>
              <label className="commerce-field">
                Einkauf CNY (optional)
                <input
                  className="commerce-input w-full"
                  name="purchase_cny"
                  type="number"
                  step="0.01"
                  min="0.01"
                />
              </label>
            </div>
            <label className="text-xs flex gap-2 items-center">
              <input type="checkbox" name="replace" />
              Bisherige Varianten ersetzen (auch Platzhalter wie „Noch
              festzulegen")
            </label>
            <button className="commerce-button secondary">
              Varianten erzeugen
            </button>
          </form>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {!p.media.length && (
              <p className="col-span-full text-sm text-muted-foreground">
                Keine Bilder. Füge unten eine Bild-URL hinzu.
              </p>
            )}
            {p.media.map((m: any, i: number) => (
              <div key={m.id} className="space-y-1">
                <img
                  src={m.url}
                  alt={m.alt}
                  className="aspect-square object-cover w-full"
                />
                <p className="text-[11px] text-muted-foreground">
                  {i === 0 ? "Titelbild · " : ""}
                  {m.kind === "size_chart"
                    ? "Größentabelle"
                    : m.kind === "ai_model"
                      ? "KI-Modellbild"
                      : "Produktfoto"}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <button
                    type="button"
                    className="text-xs underline"
                    disabled={!i}
                    onClick={() => {
                      const media = [...p.media];
                      const [moved] = media.splice(i, 1);
                      saveGallery([moved, ...media]);
                    }}
                  >
                    Als Titelbild
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    disabled={!i}
                    onClick={() => {
                      const media = [...p.media];
                      [media[i - 1], media[i]] = [media[i], media[i - 1]];
                      saveGallery(media);
                    }}
                  >
                    Nach vorn
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() =>
                      saveGallery(
                        p.media.map((x: any) =>
                          x.id === m.id
                            ? {
                                ...x,
                                kind:
                                  x.kind === "size_chart"
                                    ? "product"
                                    : "size_chart",
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    {m.kind === "size_chart"
                      ? "Als Produktfoto"
                      : "Als Größentabelle"}
                  </button>
                  <button
                    type="button"
                    className="text-xs underline text-red-400"
                    onClick={() => removeImage(m)}
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api(`products/${id}/media`, {
                  url: f.get("url"),
                  alt: f.get("alt"),
                  kind: f.get("kind"),
                  position: p.media.length,
                });
                await reload();
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          >
            <label className="commerce-field">
              Bild-URL von freigegebener Lieferantenquelle
              <input
                className="commerce-input"
                name="url"
                type="url"
                required
              />
            </label>
            <label className="commerce-field">
              Bildbeschreibung
              <input
                className="commerce-input"
                name="alt"
                defaultValue={p.title}
              />
            </label>
            <select className="commerce-input" name="kind" aria-label="Bildtyp">
              <option value="product">Produktfoto</option>
              <option value="size_chart">Größentabelle</option>
            </select>
            <button className="commerce-button secondary ml-3">
              Bild ergänzen
            </button>
          </form>
          {p.visibility === "private" && (
            <button
              className="commerce-button secondary"
              onClick={async () => {
                try {
                  await api(`products/${id}/publish-copy`, {});
                  onSaved();
                  onClose();
                } catch (e) {
                  setFailure((e as Error).message);
                }
              }}
            >
              Als Shop-Entwurf kopieren
            </button>
          )}
        </>
      )}
    </section>
  );
}
export default function Products() {
  const [showArchived, setShowArchived] = useState(false);
  const [mergeIds, setMergeIds] = useState<number[]>([]);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const { data, error, reload } = useData(
      `products?scope=admin&archived=${showArchived ? 1 : 0}&page=${page}&search=${encodeURIComponent(search)}`,
    ),
    [selected, setSelected] = useState<number | null>(null),
    [failure, setFailure] = useState("");
  return (
    <ShopShell>
      <div className="flex justify-between items-end mb-8 gap-4">
        <div>
          <p className="commerce-eyebrow">Administration</p>
          <h1 className="commerce-title">Produkte</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/listing" className="commerce-button">
            Mit KI-Assistent anlegen
          </Link>
          <button
            className="commerce-button secondary"
            onClick={async () => {
              try {
                const d = await api("products", { title: "Neues Produkt" });
                setSelected(d.id);
                await reload();
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          >
            Leeres Produkt anlegen
          </button>
        </div>
      </div>
      <Notice error={error || failure} />
      <input
        className="commerce-input w-full mb-6"
        aria-label="Produkte im Backend suchen"
        placeholder="Produkt oder Marke suchen"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <label className="mb-5 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => {
            setShowArchived(e.target.checked);
            setPage(1);
          }}
        />
        Archivierte Artikel anzeigen
      </label>
      {selected && (
        <div className="mb-8">
          <ProductEditor
            id={selected}
            onClose={() => setSelected(null)}
            onSaved={() => void reload()}
          />
        </div>
      )}
      {mergeIds.length > 1 && (
        <form
          className="commerce-panel my-6 flex flex-wrap gap-4 items-center"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(`products/${mergeIds[0]}/merge`, {
                source_ids: mergeIds.slice(1),
              });
              setMergeIds([]);
              await reload();
            } catch (e) {
              setFailure((e as Error).message);
            }
          }}
        >
          <label className="text-sm flex gap-2">
            <input type="checkbox" required />
            Ich habe geprüft: Diese Ansichten zeigen dasselbe Produkt.
          </label>
          <button className="commerce-button secondary">
            {mergeIds.length} Ansichten zu einer Galerie zusammenführen
          </button>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="p-3">Auswahl / Produkt</th>
              <th>Status</th>
              <th>Varianten</th>
              <th>Kundenpreis</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {data?.products.map((p: any) => (
              <tr className="border-b border-border" key={p.id}>
                <td className="p-3 min-w-48">
                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      aria-label={`${p.title} für Galerie auswählen`}
                      checked={mergeIds.includes(p.id)}
                      onChange={(e) =>
                        setMergeIds(
                          e.target.checked
                            ? [...mergeIds, p.id]
                            : mergeIds.filter((id) => id !== p.id),
                        )
                      }
                    />
                    <span>{p.title}</span>
                  </label>
                  <small className="text-muted-foreground">
                    {p.brand} · {p.visibility === "private" ? "Privat" : "Shop"}
                  </small>
                </td>
                <td>
                  <Status value={p.publication} />
                </td>
                <td>{p.variants.length}</td>
                <td>{eur(p.variants[0]?.price_cents)}</td>
                <td>
                  <div className="flex gap-4">
                    <button
                      className="underline"
                      onClick={() => setSelected(p.id)}
                    >
                      Bearbeiten
                    </button>
                    <Link
                      href={`/shop/product/${p.id}`}
                      className="text-muted-foreground"
                    >
                      Ansehen
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data?.total || 0} onChange={setPage} />
    </ShopShell>
  );
}
