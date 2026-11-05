"use client";
import { useState } from "react";
import Link from "next/link";
import { ShopShell } from "@/components/shop/shell";
import {
  api,
  useData,
  Notice,
  Status,
  eur,
  date,
} from "@/components/commerce/client";
function OrderManager({
  id,
  onChanged,
}: {
  id: number;
  onChanged: () => void;
}) {
  const { data, error, reload } = useData(`admin/orders/${id}`),
    [failure, setFailure] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const o = data?.order;
  async function action(path: string, b: Record<string, any>, method = "POST") {
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      await api(`admin/orders/${id}/${path}`, b, method);
      await reload();
      onChanged();
      setMessage("Gespeichert.");
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="commerce-panel mt-4 space-y-6">
      <Notice error={error || failure} text={message} />
      {o && (
        <>
          <div className="flex justify-between flex-wrap gap-3">
            <h2 className="text-xl">{o.number}</h2>
            <Link className="text-xs underline" href={`/orders/${id}`}>
              Bestellansicht
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Direktversand: {Object.values(o.address).join(", ")}
          </p>
          {["review", "offered"].includes(o.status) && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action("offers", {
                  lines: o.items.map((i: any) => ({
                    item_id: i.id,
                    size: f.get(`size_${i.id}`),
                    color: f.get(`color_${i.id}`),
                    sku: f.get(`sku_${i.id}`),
                    unit_cents: Math.round(Number(f.get(`sale_${i.id}`)) * 100),
                    purchase_fen: Math.round(
                      Number(f.get(`purchase_${i.id}`)) * 100,
                    ),
                    supplier: f.get(`supplier_${i.id}`),
                  })),
                  shipping_cents: Math.round(Number(f.get("shipping")) * 100),
                  delivery_note: f.get("delivery"),
                });
              }}
            >
              <h3 className="commerce-eyebrow">
                Alle Positionen prüfen und Angebot erstellen
              </h3>
              {o.items.map((i: any) => (
                <div key={i.id} className="border border-border p-4 space-y-4">
                  <div>
                    <strong className="text-sm">
                      {i.quantity} × {i.title}
                    </strong>
                    <p className="text-xs text-muted-foreground mt-1">
                      {i.size} · {i.color || "Laut Abbildung"} · {i.sku}
                    </p>
                    {i.source_url && (
                      <a
                        className="text-xs underline"
                        href={i.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Beschaffungsquelle
                      </a>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      ["size", "Bestätigte Größe"],
                      ["color", "Bestätigte Farbe"],
                      ["sku", "Lieferanten-SKU"],
                    ].map(([key, label]) => (
                      <label className="commerce-field" key={key}>
                        {label}
                        <input
                          className="commerce-input w-full"
                          name={`${key}_${i.id}`}
                          required={key === "size"}
                          defaultValue={i[key]}
                        />
                      </label>
                    ))}
                    <label className="commerce-field">
                      Verkauf EUR / Stück
                      <input
                        className="commerce-input w-full"
                        required
                        name={`sale_${i.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={
                          i.estimated_cents
                            ? Number(i.estimated_cents) / 100
                            : ""
                        }
                      />
                    </label>
                    <label className="commerce-field">
                      Einkauf CNY / Stück
                      <input
                        className="commerce-input w-full"
                        required
                        name={`purchase_${i.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={
                          i.purchase_fen ? Number(i.purchase_fen) / 100 : ""
                        }
                      />
                    </label>
                    <label className="commerce-field">
                      Lieferant
                      <input
                        className="commerce-input w-full"
                        required
                        name={`supplier_${i.id}`}
                        defaultValue={i.supplier}
                      />
                    </label>
                  </div>
                  <label className="flex gap-2 text-xs">
                    <input required type="checkbox" />
                    Variante und Lieferbarkeit mit Quelle geprüft
                  </label>
                </div>
              ))}
              <label className="commerce-field">
                Versandkosten EUR
                <input
                  name="shipping"
                  className="commerce-input"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </label>
              <label className="commerce-field">
                Liefererwartung und Hinweise
                <textarea
                  required
                  className="commerce-input"
                  name="delivery"
                  rows={3}
                />
              </label>
              <button className="commerce-button" disabled={busy}>
                Angebot für 48 Stunden bereitstellen
              </button>
            </form>
          )}
          {o.offers.length > 0 && (
            <div>
              <h3 className="commerce-eyebrow mb-3">Angebotsverlauf</h3>
              {o.offers.map((f: any) => (
                <p key={f.id} className="text-sm mb-2">
                  Version {f.version} · {eur(f.total_cents)} ·{" "}
                  {f.accepted_at
                    ? "Angenommen"
                    : `Gültig bis ${date(f.expires_at)}`}
                </p>
              ))}
            </div>
          )}
          {o.payments.map((p: any) => (
            <section
              key={p.id}
              className="border-t border-border pt-5 space-y-3"
            >
              <h3>
                Zahlung {p.id} · {p.currency} / {p.network}
              </h3>
              <Status value={p.status} />
              <p className="text-xs break-all">
                Wallet: {p.address}
                <br />
                Betrag in kleinster Einheit: {p.amount_atoms}
                <br />
                TXID: {p.txid || "Noch nicht eingereicht"}
              </p>
              {p.exception && (
                <Notice error={`Zahlungsabweichung: ${p.exception}`} />
              )}{" "}
              {["submitted", "exception"].includes(p.status) && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action("payments", {
                      payment_id: p.id,
                      actual_atoms: f.get("actual"),
                      verified_network: f.get("network"),
                      verified_address: f.get("address"),
                      resolve_exception: f.get("resolve") === "on",
                      note: f.get("note"),
                    });
                  }}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="commerce-field">
                      Verifiziertes Netzwerk
                      <input
                        className="commerce-input w-full"
                        name="network"
                        required
                        placeholder={p.network}
                      />
                    </label>
                    <label className="commerce-field">
                      Verifizierter Empfänger
                      <input
                        className="commerce-input w-full"
                        name="address"
                        required
                        placeholder={p.address}
                      />
                    </label>
                  </div>
                  <label className="commerce-field">
                    Empfangener Betrag in kleinster Einheit
                    <input
                      className="commerce-input"
                      name="actual"
                      required
                      inputMode="numeric"
                      placeholder={p.amount_atoms}
                    />
                  </label>
                  <label className="text-xs flex gap-2">
                    <input required type="checkbox" />
                    Transaktion, Bestätigungen und Eingang geprüft
                  </label>
                  <label className="text-xs flex gap-2">
                    <input type="checkbox" name="resolve" />
                    Abweichung ausdrücklich freigeben
                  </label>
                  <input
                    className="commerce-input w-full"
                    name="note"
                    placeholder="Begründung bei Ausnahme"
                    aria-label="Begründung"
                  />
                  <button disabled={busy} className="commerce-button">
                    Zahlung prüfen / bestätigen
                  </button>
                </form>
              )}
            </section>
          ))}
          {o.payment_status === "confirmed" && (
            <button
              className="commerce-button"
              disabled={busy || o.status === "completed"}
              onClick={() => void action("purchases", {})}
            >
              Offene Mengen als Lieferantenaufträge vorbereiten
            </button>
          )}
          {data?.purchases.map((po: any) => (
            <section key={po.id} className="border border-border p-5 space-y-4">
              <div className="flex justify-between flex-wrap gap-3">
                <h3>
                  {po.number} · {po.supplier}
                </h3>
                <Status value={po.status} />
              </div>
              {po.items.map((i: any) => (
                <p key={i.id} className="text-sm">
                  {i.quantity} × {i.title} · {i.size} / {i.color} · Einkauf CNY{" "}
                  {(Number(i.purchase_fen) / 100).toFixed(2)}
                </p>
              ))}
              <div className="flex flex-wrap gap-3">
                <a
                  className="commerce-button secondary"
                  href={`/api/commerce/admin/orders/${id}/purchases/${po.id}/export?format=xlsx`}
                >
                  Excel exportieren
                </a>
                <button
                  className="commerce-button secondary"
                  onClick={async () => {
                    try {
                      const d = await api(
                        `admin/orders/${id}/purchases/${po.id}/export`,
                      );
                      await navigator.clipboard.writeText(d.text);
                      setMessage("Bestelltext kopiert.");
                    } catch (e) {
                      setFailure((e as Error).message);
                    }
                  }}
                >
                  Bestelltext kopieren
                </button>
              </div>
              {po.status === "draft" && (
                <form
                  className="flex flex-wrap gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(
                      `purchases/${po.id}`,
                      {
                        status: "sent",
                        recipient: new FormData(e.currentTarget).get(
                          "recipient",
                        ),
                      },
                      "PATCH",
                    );
                  }}
                >
                  <input
                    className="commerce-input flex-1"
                    name="recipient"
                    required
                    placeholder="Empfänger und Versandkanal"
                    aria-label="Empfänger und Versandkanal"
                  />
                  <button disabled={busy} className="commerce-button">
                    Tatsächliche Übergabe protokollieren
                  </button>
                </form>
              )}
              {po.status === "sent" && (
                <form
                  className="flex flex-wrap gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(
                      `purchases/${po.id}`,
                      {
                        status: "confirmed",
                        external_reference: new FormData(e.currentTarget).get(
                          "reference",
                        ),
                      },
                      "PATCH",
                    );
                  }}
                >
                  <input
                    className="commerce-input flex-1"
                    name="reference"
                    required
                    placeholder="Lieferantenbestellnummer"
                    aria-label="Lieferantenbestellnummer"
                  />
                  <button disabled={busy} className="commerce-button">
                    Lieferantenbestätigung
                  </button>
                </form>
              )}
              {po.status === "confirmed" && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action("shipments", {
                      purchase_order_id: po.id,
                      carrier: f.get("carrier"),
                      tracking: f.get("tracking"),
                      items: po.items
                        .map((i: any) => ({
                          purchase_item_id: i.id,
                          quantity: Number(f.get(`qty_${i.id}`)),
                        }))
                        .filter((i: any) => i.quantity > 0),
                    });
                  }}
                >
                  <h4 className="commerce-eyebrow">Direktversand erfassen</h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      name="carrier"
                      className="commerce-input"
                      required
                      placeholder="Versanddienstleister"
                      aria-label="Versanddienstleister"
                    />
                    <input
                      name="tracking"
                      className="commerce-input"
                      required
                      placeholder="Trackingnummer"
                      aria-label="Trackingnummer"
                    />
                  </div>
                  {po.items.map((i: any) => (
                    <label key={i.id} className="commerce-field">
                      Versandmenge: {i.title}
                      <input
                        className="commerce-input"
                        name={`qty_${i.id}`}
                        type="number"
                        min="0"
                        max={i.quantity - Number(i.shipped || 0)}
                        defaultValue={i.quantity - Number(i.shipped || 0)}
                      />
                    </label>
                  ))}
                  <button className="commerce-button" disabled={busy}>
                    Sendung speichern
                  </button>
                </form>
              )}
              {["sent", "confirmed"].includes(po.status) && (
                <button
                  className="text-xs underline text-red-300"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      `purchases/${po.id}`,
                      { status: "unavailable" },
                      "PATCH",
                    )
                  }
                >
                  Nichtlieferbarkeit melden
                </button>
              )}
              {["draft", "unavailable"].includes(po.status) && (
                <button
                  className="text-xs underline"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      `purchases/${po.id}`,
                      { status: "cancelled" },
                      "PATCH",
                    )
                  }
                >
                  Lieferantenauftrag stornieren
                </button>
              )}
            </section>
          ))}
          {o.shipments.map((s: any) => (
            <div
              key={s.id}
              className="flex flex-wrap justify-between gap-4 border-t border-border pt-4"
            >
              <p className="text-sm">
                {s.carrier} · {s.tracking}
              </p>
              <Status value={s.status} />
              {s.status === "shipped" && (
                <button
                  className="text-xs underline"
                  disabled={busy}
                  onClick={() =>
                    void action("shipments", { shipment_id: s.id }, "PATCH")
                  }
                >
                  Zustellung bestätigen
                </button>
              )}
            </div>
          ))}
          {["confirmed", "partially_refunded"].includes(o.payment_status) && (
            <details className="border-t border-border pt-4">
              <summary className="cursor-pointer text-sm">
                Erstattung dokumentieren
              </summary>
              <form
                className="space-y-3 mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action("refunds", {
                    amount_cents: Math.round(Number(f.get("amount")) * 100),
                    reference: f.get("reference"),
                    note: f.get("note"),
                  });
                }}
              >
                <input
                  className="commerce-input w-full"
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Erstattung EUR"
                  aria-label="Erstattung EUR"
                />
                <input
                  className="commerce-input w-full"
                  name="reference"
                  required
                  placeholder="Erstattungstransaktion / Referenz"
                  aria-label="Erstattungsreferenz"
                />
                <textarea
                  className="commerce-input w-full"
                  name="note"
                  required
                  placeholder="Begründung"
                  aria-label="Erstattungsbegründung"
                />
                <p className="text-xs text-muted-foreground">
                  Die Überweisung erfolgt außerhalb des Shops. Hier wird die
                  ausgeführte Erstattung dokumentiert.
                </p>
                <button className="commerce-button secondary" disabled={busy}>
                  Erstattung dokumentieren
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </div>
  );
}
export default function AdminOrders() {
  const { data, error, reload } = useData("admin/orders");
  const [selected, setSelected] = useState<number | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  return (
    <ShopShell>
      <p className="commerce-eyebrow">Administration · Direktversand</p>
      <h1 className="commerce-title mb-8">Aufträge verwalten.</h1>
      <Notice error={error} />
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="commerce-input flex-1"
          aria-label="Bestellungen suchen"
          placeholder="Bestellnummer oder Kunde"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="commerce-input"
          aria-label="Status filtern"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Alle Status</option>
          {[
            "review",
            "offered",
            "confirmed",
            "procurement",
            "completed",
            "cancelled",
          ].map((v) => (
            <option key={v} value={v}>
              {
                (
                  {
                    review: "Prüfen",
                    offered: "Angebot offen",
                    confirmed: "Angenommen",
                    procurement: "Beschaffung",
                    completed: "Abgeschlossen",
                    cancelled: "Storniert",
                  } as Record<string, string>
                )[v]
              }
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-3">
        {data?.orders
          .filter(
            (o: any) =>
              (!status || o.status === status) &&
              `${o.number} ${o.user_name}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((o: any) => (
            <article key={o.id}>
              <button
                className="commerce-panel w-full text-left flex flex-wrap justify-between items-center gap-4"
                aria-expanded={selected === o.id}
                onClick={() => setSelected(selected === o.id ? null : o.id)}
              >
                <span>
                  <strong>{o.number}</strong>
                  <span className="block text-xs text-muted-foreground mt-2">
                    {o.user_name} · {date(o.created_at)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Status value={o.status} />
                  <Status value={o.payment_status} />
                </span>
              </button>
              {selected === o.id && (
                <OrderManager id={o.id} onChanged={() => void reload()} />
              )}
            </article>
          ))}
      </div>
    </ShopShell>
  );
}
