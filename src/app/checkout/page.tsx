"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShopShell } from "@/components/shop/shell";
import { api, useData, eur, Notice } from "@/components/commerce/client";
export default function Checkout() {
  const { data, error } = useData("session"),
    addresses = useData("addresses");
  const router = useRouter();
  const key = useRef("");
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [address, setAddress] = useState({
      name: "",
      street: "",
      zip: "",
      city: "",
      country: "DE",
    });
  return (
    <ShopShell>
      <p className="commerce-eyebrow">Schritt 1 · Anfrage</p>
      <h1 className="mb-8 text-3xl font-medium tracking-tight md:text-4xl">
        Bestellanfrage
      </h1>
      <Notice error={error || failure} />
      <form
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setFailure("");
          if (!key.current) key.current = crypto.randomUUID();
          try {
            const d = await api(
              "checkout",
              { address, version: data?.cart.version },
              "POST",
              { "Idempotency-Key": key.current },
            );
            router.push(`/orders/${d.order.id}`);
          } catch (e) {
            setFailure((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="space-y-4">
          <h2 className="mb-4 text-xl">Lieferadresse</h2>
          {addresses.data?.addresses.length > 0 && (
            <label className="commerce-field">
              Gespeicherte Adresse
              <select
                className="commerce-input"
                defaultValue=""
                onChange={(e) => {
                  const a = addresses.data?.addresses.find(
                    (a: any) => String(a.id) === e.target.value,
                  );
                  if (a) setAddress(a.address);
                }}
              >
                <option value="">Adresse auswählen</option>
                {addresses.data?.addresses.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {[
            ["name", "Vollständiger Name"],
            ["street", "Straße und Hausnummer"],
            ["zip", "Postleitzahl"],
            ["city", "Ort"],
          ].map(([key, label]) => (
            <label key={key} className="commerce-field">
              {label}
              <input
                className="commerce-input"
                required
                maxLength={key === "zip" ? 20 : 200}
                autoComplete={
                  {
                    name: "name",
                    street: "street-address",
                    zip: "postal-code",
                    city: "address-level2",
                  }[key]
                }
                value={address[key as keyof typeof address]}
                onChange={(e) =>
                  setAddress({ ...address, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <label className="commerce-field">
            Land
            <select
              required
              className="commerce-input"
              value={address.country}
              onChange={(e) =>
                setAddress({ ...address, country: e.target.value })
              }
            >
              {data?.countries.map((c: string) => (
                <option key={c} value={c}>
                  {new Intl.DisplayNames(["de"], { type: "region" }).of(c) || c}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="text-xs underline"
            onClick={async () => {
              try {
                await api("addresses", { label: address.name, address });
                await addresses.reload();
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          >
            Adresse im Konto speichern
          </button>
        </section>
        <aside className="commerce-panel self-start space-y-5">
          <h2 className="text-xl">Zusammenfassung</h2>
          {data?.cart.lines.map((l: any) => (
            <div className="flex justify-between gap-4 text-sm" key={l.id}>
              <span>
                {l.quantity} × {l.title}
                <small className="block text-muted-foreground">
                  {l.variant.size} · {l.variant.color}
                </small>
              </span>
              <span className="shrink-0">{eur(l.estimated_cents)}</span>
            </div>
          ))}
          <p className="border-t border-white/10 pt-5 text-sm text-muted-foreground">
            Dies ist eine Anfrage zur Prüfung. Versandkosten und verbindlichen
            Gesamtpreis erhältst du im Angebot. Jetzt ist keine Zahlung
            erforderlich.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" required className="mt-1" />
            Ich bestätige meine Auswahl und Lieferadresse und möchte ein
            geprüftes Angebot erhalten.
          </label>
          <button
            className="commerce-button w-full"
            disabled={busy || !data?.cart.lines.length}
          >
            {busy ? "Wird eingereicht …" : "Zur Prüfung einreichen"}
          </button>
          <Link href="/cart" className="block text-center text-xs underline">
            Zurück zum Warenkorb
          </Link>
        </aside>
      </form>
    </ShopShell>
  );
}
