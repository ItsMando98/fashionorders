"use client";
import { useState } from "react";
import { ShopShell } from "@/components/shop/shell";
import { api, useData, Notice, Status } from "@/components/commerce/client";
import { SupplierManager } from "@/components/commerce/supplier-manager";
import { MemberPricing } from "@/components/commerce/member-pricing";
import { SourceManager } from "@/components/commerce/source-manager";
export default function Settings() {
  const { data, error, reload } = useData("admin/settings");
  const [failure, setFailure] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(path: string, b: Record<string, any>, method = "POST") {
    setBusy(true);
    try {
      await api(path, b, method);
      setMessage("Einstellungen gespeichert.");
      await reload();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ShopShell>
      <p className="commerce-eyebrow">Administration</p>
      <h1 className="commerce-title mb-8">Shop-Einstellungen</h1>
      <Notice error={error || failure} text={message} />
      {data && (
        <div className="grid lg:grid-cols-2 gap-8">
          <form
            className="commerce-panel space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "admin/settings",
                Object.fromEntries(new FormData(e.currentTarget)),
                "PATCH",
              );
            }}
          >
            <h2 className="text-xl">Betreiber und Versand</h2>
            {[
              ["shop_operator", "Betreiberangaben"],
              ["shop_tax_note", "Preis-/Steuerhinweis"],
              ["shop_countries", "Lieferländer, z. B. DE,AT"],
              ["cny_to_eur", "EUR je CNY"],
              ["default_item_fixed_eur", "Interner Artikelaufschlag EUR"],
              ["default_item_percent", "Interner Artikelaufschlag Prozent"],
              ["default_haul_percent", "Interner Gesamtaufschlag Prozent"],
            ].map(([key, label]) => (
              <label className="commerce-field" key={key}>
                {label}
                <textarea
                  className="commerce-input"
                  name={key}
                  required
                  defaultValue={data.settings[key] || ""}
                />
              </label>
            ))}
            <button disabled={busy} className="commerce-button">
              Speichern
            </button>
          </form>
          <section className="commerce-panel space-y-5">
            <h2 className="text-xl">Crypto-Zahlungsarten</h2>
            <p className="text-sm text-muted-foreground">
              Nur explizit konfigurierte Netzwerke aktivieren. Beim Aktivieren
              wird die Kursquelle geprüft.
            </p>
            {data.methods
              .filter((m: any) => ["BTC", "USDC"].includes(m.currency))
              .map((m: any) => (
                <div key={m.id} className="border-b border-border pb-4">
                  <p className="text-sm">
                    {m.currency} · {m.network}{" "}
                    <Status value={m.enabled ? "confirmed" : "draft"} />
                  </p>
                  <p className="text-xs font-mono break-all text-muted-foreground mt-2">
                    {m.address}
                  </p>
                  <button
                    className="text-xs underline mt-2"
                    onClick={() =>
                      void save("admin/payment-methods", {
                        ...m,
                        enabled: !m.enabled,
                      })
                    }
                  >
                    {m.enabled ? "Deaktivieren" : "Aktivieren"}
                  </button>
                </div>
              ))}
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  currency = String(f.get("currency"));
                void save("admin/payment-methods", {
                  currency,
                  network: currency === "BTC" ? "bitcoin" : "ethereum",
                  address: f.get("address"),
                  enabled: f.get("enabled") === "on",
                });
              }}
            >
              <label className="commerce-field">
                Coin und Netzwerk
                <select className="commerce-input" name="currency">
                  <option value="BTC">BTC · Bitcoin</option>
                  <option value="USDC">USDC · Ethereum ERC-20</option>
                </select>
              </label>
              <label className="commerce-field">
                Empfangsadresse
                <input name="address" required className="commerce-input" />
              </label>
              <label className="text-sm flex gap-3">
                <input type="checkbox" name="enabled" />
                Aktivieren und Kurs prüfen
              </label>
              <button disabled={busy} className="commerce-button secondary">
                Zahlungsart speichern
              </button>
            </form>
          </section>
        </div>
      )}
      {data && (
        <>
          <SourceManager />
          <SupplierManager />
          <MemberPricing />
        </>
      )}
    </ShopShell>
  );
}
