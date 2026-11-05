"use client";
import { useState } from "react";
import { api, useData, Notice } from "./client";
export function SupplierManager() {
  const { data, error, reload } = useData("admin/suppliers"),
    [failure, setFailure] = useState("");
  async function save(form: HTMLFormElement) {
    const f = new FormData(form);
    try {
      await api("admin/suppliers", {
        name: f.get("name"),
        contact: f.get("contact"),
        channel: f.get("channel"),
        notes: f.get("notes"),
        active: f.get("active") === "on",
      });
      await reload();
    } catch (e) {
      setFailure((e as Error).message);
    }
  }
  return (
    <details className="commerce-panel mt-8">
      <summary className="cursor-pointer text-xl">
        Lieferanten und Übergabekanäle
      </summary>
      <Notice error={error || failure} />
      <div className="space-y-5 mt-5">
        {[
          ...(data?.suppliers || []),
          {
            id: "new",
            name: "",
            contact: "",
            channel: "",
            notes: "",
            active: true,
          },
        ].map((s) => (
          <form
            key={s.id}
            className="grid sm:grid-cols-2 gap-3 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save(e.currentTarget);
            }}
          >
            {[
              ["name", "Lieferantenname"],
              ["contact", "Kontakt / Empfänger"],
              ["channel", "Kanal, z. B. E-Mail oder WeChat"],
              ["notes", "Interne Notizen"],
            ].map(([key, label]) => (
              <label className="commerce-field" key={key}>
                {label}
                <input
                  className="commerce-input"
                  name={key}
                  defaultValue={s[key]}
                  required={key === "name"}
                />
              </label>
            ))}
            <label className="text-xs flex gap-2 items-center">
              <input name="active" type="checkbox" defaultChecked={s.active} />
              Aktiv
            </label>
            <button className="commerce-button secondary">
              {s.id === "new" ? "Lieferant anlegen" : "Speichern"}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
