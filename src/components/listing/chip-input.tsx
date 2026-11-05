"use client";
import { useState } from "react";
import { X } from "lucide-react";

/**
 * Eingabefeld für Listen aus kurzen Begriffen (Größen, Merkmale, Tags) – FRONTEND.
 * Enter oder Komma fügt einen Begriff hinzu, Rücktaste im leeren Feld löscht den letzten.
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  label,
  max = 40,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const known = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const p of parts)
      if (!known.has(p.toLowerCase()) && next.length < max) {
        known.add(p.toLowerCase());
        next.push(p);
      }
    onChange(next);
    setDraft("");
  }
  return (
    <div className="commerce-input flex min-h-11 flex-wrap items-center gap-2 !py-2">
      {value.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs"
        >
          {chip}
          <button
            type="button"
            aria-label={`${chip} entfernen`}
            onClick={() => onChange(value.filter((v) => v !== chip))}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        className="min-w-32 flex-1 bg-transparent text-sm outline-none"
        placeholder={value.length ? "" : placeholder}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length)
            onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)}
      />
    </div>
  );
}
