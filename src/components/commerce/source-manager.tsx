"use client";
import { useEffect, useState } from "react";
import { Notice, Status } from "./client";
export function SourceManager() {
  const [sources, setSources] = useState<any[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/admin/scrape-sources");
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail);
      setSources(d.sources);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(
    path: string,
    body: Record<string, any>,
    method = "POST",
  ) {
    try {
      const r = await fetch("/api/admin/scrape-sources" + path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail);
      await load();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="commerce-panel mt-8 space-y-5">
      <h2 className="text-xl">Automatische Lieferantenimporte</h2>
      <p className="text-sm text-muted-foreground">
        Neue Alben werden als Entwürfe importiert. Bilder, Varianten und
        Produktzuordnung vor der Veröffentlichung prüfen.
      </p>
      <Notice error={error} />
      {sources.map((s) => (
        <div key={s.id} className="border-t border-border pt-4 space-y-3">
          <p className="text-sm">
            {s.label || s.seller_url}{" "}
            <Status value={s.active ? "confirmed" : "draft"} />
          </p>
          <p className="text-xs text-muted-foreground">
            Alle {s.interval_hours} Stunden · alle Alben · {s.last_message}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="commerce-button secondary"
              onClick={() => void save(`/${s.id}/run`, {})}
            >
              Jetzt einreihen
            </button>
            <button
              className="text-xs underline"
              onClick={() =>
                void save(`/${s.id}`, { active: !s.active }, "PATCH")
              }
            >
              {s.active ? "Pausieren" : "Aktivieren"}
            </button>
          </div>
        </div>
      ))}
      <form
        className="grid sm:grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save("", Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <label className="commerce-field">
          Yupoo-Lieferantenadresse
          <input
            name="seller_url"
            type="url"
            required
            className="commerce-input"
            placeholder="https://seller.x.yupoo.com"
          />
        </label>
        <label className="commerce-field">
          Bezeichnung
          <input name="label" className="commerce-input" />
        </label>
        <label className="commerce-field">
          Intervall in Stunden
          <input
            name="interval_hours"
            className="commerce-input"
            type="number"
            min="1"
            max="720"
            defaultValue="24"
          />
        </label>

        <button className="commerce-button">Quelle hinzufügen</button>
      </form>
    </section>
  );
}
