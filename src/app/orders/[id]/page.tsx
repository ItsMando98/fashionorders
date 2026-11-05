"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ShopShell } from "@/components/shop/shell";
import {
  useData,
  api,
  Status,
  Notice,
  eur,
  cny,
  date,
} from "@/components/commerce/client";
import { paymentUri } from "@/lib/commerce/payment-uri";
export default function OrderDetail() {
  const { id } = useParams();
  const [clock,setClock]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const { data, error, reload } = useData(`orders/${id}`);
  const [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false),
    [qr, setQr] = useState("");
  const o = data?.order,
    offer = o?.offers[0],
    payment = o?.payments[0];
  useEffect(() => {
    let active = true;
    setQr("");
    if (payment) {
      const uri = paymentUri(payment);
      if (uri)
        void QRCode.toDataURL(uri, { width: 240, margin: 2 }).then((v) => {
          if (active) setQr(v);
        });
    }
    return () => {
      active = false;
    };
  }, [payment?.id]);
  async function action(path: string, body: Record<string, any>) {
    setBusy(true);
    setFailure("");
    try {
      await api(`orders/${id}/${path}`, body);
      await reload();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ShopShell>
      <Link className="text-xs text-muted-foreground" href="/orders">
        ← Alle Bestellungen
      </Link>
      <Notice error={error || failure} />
      {o && (
        <>
          <div className="flex flex-wrap justify-between items-end gap-5 my-8">
            <div>
              <p className="commerce-eyebrow">Bestellübersicht</p>
              <h1 className="text-3xl mt-3">{o.number}</h1>
            </div>
            <div className="flex gap-2">
              <Status value={o.status} />
              <Status value={o.payment_status} />
            </div>
          </div>
          <div className="grid lg:grid-cols-[1fr_380px] gap-8">
            <section className="space-y-6">
              <div className="commerce-panel">
                <h2 className="text-xl mb-5">Deine Artikel</h2>
                {o.items.map((i: any) => (
                  <div
                    key={i.id}
                    className="flex justify-between border-t border-border py-4 gap-4"
                  >
                    <div>
                      <p>
                        {i.quantity} × {i.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {i.size} · {i.color || "Laut Abbildung"}
                      </p>
                    </div>
                    <span className="text-sm shrink-0">
                      {eur(
                        i.estimated_cents == null
                          ? null
                          : Number(i.estimated_cents) * i.quantity,
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {offer && (
                <div className="commerce-panel space-y-4">
                  <div className="flex justify-between">
                    <h2 className="text-xl">Angebot {offer.version}</h2>
                    <Status
                      value={offer.accepted_at ? "confirmed" : "offered"}
                    />
                  </div>
                  {offer.lines.map((l: any) => (
                    <div
                      className="flex justify-between text-sm gap-4"
                      key={l.item_id}
                    >
                      <span>
                        {l.quantity} × {l.title}
                        <small className="block text-muted-foreground">
                          {l.size} · {l.color}
                        </small>
                      </span>
                      <span className="shrink-0">
                        {eur(l.unit_cents * l.quantity)}
                      </span>
                    </div>
                  ))}
                  <p className="flex justify-between text-sm">
                    <span>Versand</span>
                    <span>{eur(offer.shipping_cents)}</span>
                  </p>
                  <p className="flex justify-between text-lg border-t border-border pt-4">
                    <strong>Gesamt</strong>
                    <strong>{eur(offer.total_cents)}</strong>
                  </p>
                  <p className="text-right text-sm text-muted-foreground">
                    {cny(offer.total_fen)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {offer.delivery_note}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {offer.accepted_at
                      ? `Angenommen am ${date(offer.accepted_at)}`
                      : `Gültig bis ${date(offer.expires_at)}`}
                  </p>
                  {o.status === "offered" && !offer.accepted_at && (
                    <button
                      className="commerce-button w-full"
                      disabled={busy || new Date(offer.expires_at) < new Date()}
                      onClick={() =>
                        void action("offers", { offer_id: offer.id })
                      }
                    >
                      Angebot verbindlich annehmen
                    </button>
                  )}
                </div>
              )}
              {o.shipments.length > 0 && (
                <div className="commerce-panel">
                  <h2 className="text-xl mb-4">Deine Pakete</h2>
                  {o.shipments.map((s: any) => (
                    <div
                      className="border-t border-border py-4 space-y-2"
                      key={s.id}
                    >
                      <div className="flex justify-between">
                        <strong>{s.carrier}</strong>
                        <Status value={s.status} />
                      </div>
                      <p className="font-mono text-sm break-all">
                        {s.tracking}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.items
                          .map(
                            (i: any) =>
                              `${i.quantity} × ${o.items.find((x: any) => x.id === i.item_id)?.title || "Artikel"}`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <details className="commerce-panel">
                <summary className="cursor-pointer">Bestellverlauf</summary>
                <ol className="mt-4 space-y-3">
                  {o.events.map((e: any) => (
                    <li key={e.id} className="text-sm">
                      <span className="text-muted-foreground text-xs mr-3">
                        {date(e.created_at)}
                      </span>
                      {(
                        {
                          submitted: "Zur Prüfung eingereicht",
                          offered: "Angebot erstellt",
                          accepted: "Angebot angenommen",
                          payment_requested: "Zahlungsanforderung erstellt",
                          payment_submitted: "Zahlung eingereicht",
                          payment_confirmed: "Zahlung bestätigt",
                          procurement_created: "Beschaffung vorbereitet",
                          supplier_sent: "An Lieferant übergeben",
                          supplier_confirmed: "Lieferant hat bestätigt",
                          shipped: "Versendet",
                          delivered: "Zugestellt",
                          cancelled: "Storniert",
                          refunded: "Erstattung dokumentiert",
                        } as Record<string, string>
                      )[e.type] || "Bestellung aktualisiert"}
                    </li>
                  ))}
                </ol>
              </details>
            </section>
            <aside className="space-y-6">
              <div className="commerce-panel">
                <h2 className="text-xl mb-4">Lieferadresse</h2>
                <address className="not-italic text-sm leading-6 text-muted-foreground">
                  {o.address.name}
                  <br />
                  {o.address.street}
                  <br />
                  {o.address.zip} {o.address.city}
                  <br />
                  {o.address.country}
                </address>
              </div>
              {o.status === "review" && (
                <div className="commerce-panel">
                  <h2 className="text-xl">Wir prüfen deine Auswahl.</h2>
                  <p className="text-sm text-muted-foreground mt-3">
                    Sobald Preise, Versand und Lieferbarkeit feststehen, findest
                    du hier dein Angebot.
                  </p>
                </div>
              )}
              {o.status === "confirmed" && o.payment_status !== "confirmed" && (
                <div className="commerce-panel space-y-4">
                  <h2 className="text-xl">Crypto-Zahlung</h2>
                  {!payment ||
                  (["pending", "expired"].includes(payment.status) &&
                    new Date(payment.expires_at) <= new Date()) ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Wähle Coin und Netzwerk. Dein Zahlbetrag gilt 15
                        Minuten.
                      </p>
                      {o.methods.length ? (
                        o.methods.map((m: any) => (
                          <button
                            className="commerce-button secondary w-full"
                            disabled={busy}
                            key={m.id}
                            onClick={() =>
                              void action("payment-requests", {
                                method_id: m.id,
                              })
                            }
                          >
                            {m.currency} · {m.network}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm">
                          Zahlungsarten werden gerade eingerichtet.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Status value={payment.status} />
                      <p className="text-xs uppercase">
                        {payment.currency} · {payment.network}
                      </p>
                      <p className="font-mono text-lg break-all">
                        {BigInt(payment.amount_atoms)
                          .toString()
                          .padStart(payment.decimals + 1, "0")
                          .replace(
                            new RegExp(`(.{${payment.decimals}})$`),
                            ".$1",
                          )}{" "}
                        {payment.currency}
                      </p>
                      <p className="text-xs">
                        Gültig bis {date(payment.expires_at)} · {Math.max(0,Math.ceil((new Date(payment.expires_at).getTime()-clock)/60000))} Min. verbleibend
                      </p>
                      {qr && (
                        <img
                          src={qr}
                          alt={`Zahlungs-QR für ${payment.currency} auf ${payment.network}`}
                          className="w-48 mx-auto"
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        Nur über das angegebene Netzwerk senden.
                        Netzwerkgebühren zusätzlich berücksichtigen.
                      </p>
                      <p className="font-mono text-xs break-all">
                        {payment.address}
                      </p>
                      <button
                        className="commerce-button secondary w-full"
                        onClick={() =>
                          void navigator.clipboard.writeText(payment.address)
                        }
                      >
                        Wallet kopieren
                      </button>
                      {!payment.txid && (
                        <form
                          className="space-y-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void action("txid", {
                              payment_id: payment.id,
                              txid: new FormData(e.currentTarget).get("txid"),
                            });
                          }}
                        >
                          <label className="commerce-field">
                            Transaktions-ID
                            <input
                              className="commerce-input"
                              name="txid"
                              required
                            />
                          </label>
                          <button
                            className="commerce-button w-full"
                            disabled={busy}
                          >
                            Zahlung zur Prüfung einreichen
                          </button>
                        </form>
                      )}
                      {payment.txid && (
                        <p className="text-xs break-all">
                          TXID: {payment.txid}
                          <br />
                          Der Zahlungseingang wird manuell geprüft.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
              {o.payments.length > 1 && (
                <details className="commerce-panel">
                  <summary>Frühere Zahlungsanforderungen</summary>
                  {o.payments.slice(1).map((p: any) => (
                    <div key={p.id} className="mt-4 text-xs space-y-2">
                      <p>
                        {p.currency} · {date(p.expires_at)}
                      </p>
                      <Status value={p.status} />
                      {!p.txid && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void action("txid", {
                              payment_id: p.id,
                              txid: new FormData(e.currentTarget).get("txid"),
                            });
                          }}
                        >
                          <input
                            className="commerce-input w-full"
                            aria-label="TXID der früheren Zahlung"
                            name="txid"
                            required
                          />
                          <button
                            className="commerce-button secondary mt-2"
                            disabled={busy}
                          >
                            Verspätete Zahlung melden
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </details>
              )}
              {["review", "offered", "confirmed"].includes(o.status) &&
                !o.payments.some((p: any) => p.txid) && (
                  <button
                    className="text-xs underline text-muted-foreground"
                    disabled={busy}
                    onClick={() => void action("cancel", {})}
                  >
                    Anfrage stornieren
                  </button>
                )}
            </aside>
          </div>
        </>
      )}
    </ShopShell>
  );
}
