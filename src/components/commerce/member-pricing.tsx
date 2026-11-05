"use client";
import { useState } from "react";
import { useData, Notice } from "./client";
export function MemberPricing() {
  const { data, error, reload } = useData("admin/members"),
    [failure, setFailure] = useState("");
  return (
    <details className="commerce-panel mt-8">
      <summary className="cursor-pointer text-xl">
        Individuelle Kundenkonditionen
      </summary>
      <Notice error={error || failure} />
      <div className="space-y-5 mt-6">
        {data?.members.map((m: any) => (
          <form
            key={m.id}
            className="border-t border-border pt-4 grid sm:grid-cols-4 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                body: Record<string, any> = {};
              for (const [field, reset] of [
                ["custom_item_fixed_eur", "reset_item_fixed"],
                ["custom_item_percent", "reset_item_percent"],
                ["custom_haul_percent", "reset_haul_percent"],
              ]) {
                const raw = String(f.get(field) || "");
                if (!raw) body[reset] = true;
                else body[field] = Number(raw);
              }
              try {
                const r = await fetch(`/api/admin/users/${m.id}/fees`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                if (!r.ok)
                  throw new Error(
                    "Konditionen konnten nicht gespeichert werden.",
                  );
                await reload();
                setFailure("");
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          >
            <strong className="text-sm sm:col-span-4">{m.name}</strong>
            {[
              ["custom_item_fixed_eur", "Artikel EUR"],
              ["custom_item_percent", "Artikel %"],
              ["custom_haul_percent", "Gesamt %"],
            ].map(([field, label]) => (
              <label key={field} className="commerce-field">
                {label}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name={field}
                  defaultValue={m[field] ?? ""}
                  placeholder="Standard"
                  className="commerce-input w-full"
                />
              </label>
            ))}
            <button className="commerce-button secondary self-end">
              Speichern
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
