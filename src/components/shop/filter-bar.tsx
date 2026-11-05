"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { colorHex } from "./colors";

type Category = { id: string; parent_id: string | null; label: string };
type Facets = Record<string, string[]>;
type Counts = Record<string, Record<string, number>>;

function useDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return desktop;
}

function FilterPanel({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useDesktop();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !desktop) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, desktop]);
  const trigger = (
    <button
      type="button"
      className={`commerce-pill ${active || open ? "selected" : ""}`}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      {label}
      <ChevronDown size={14} />
    </button>
  );
  if (desktop)
    return (
      <div className="relative" ref={box}>
        {trigger}
        {open && (
          <div
            role="dialog"
            aria-label={label}
            className="commerce-filter-panel absolute left-0 z-30 mt-2 min-w-56"
          >
            {children(() => setOpen(false))}
          </div>
        )}
      </div>
    );
  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[70vh] overflow-auto px-4 pb-8">
            {children(() => setOpen(false))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function OptionList({
  options,
  counts,
  value,
  onPick,
  swatches,
}: {
  options: string[];
  counts?: Record<string, number>;
  value: string;
  onPick: (next: string) => void;
  swatches?: boolean;
}) {
  if (!options.length)
    return <p className="text-sm text-muted-foreground">Keine Werte.</p>;
  return (
    <ul className="space-y-0.5">
      {options.map((opt) => (
        <li key={opt}>
          <button
            type="button"
            className={`commerce-filter-option ${value === opt ? "selected" : ""}`}
            aria-pressed={value === opt}
            onClick={() => onPick(value === opt ? "" : opt)}
          >
            {swatches && (
              <span
                aria-hidden
                className="inline-block h-3.5 w-3.5 rounded-full border border-white/25"
                style={{ background: colorHex(opt) || "hsl(var(--muted))" }}
              />
            )}
            <span className="flex-1 text-left">{opt}</span>
            {counts?.[opt] != null && (
              <span className="text-muted-foreground">({counts[opt]})</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CategoryBar({
  categories,
  params,
  onChange,
}: {
  categories: Category[];
  params: URLSearchParams;
  onChange: (key: string, value: string) => void;
}) {
  const gender = params.get("gender") || "";
  const selected = params.get("category") || "";
  const current = categories.find((c) => c.id === selected);
  const roots = categories.filter((c) => !c.parent_id);
  const children = current
    ? categories.filter((c) => c.parent_id === current.id)
    : [];
  const siblings = current?.parent_id
    ? categories.filter((c) => c.parent_id === current.parent_id)
    : [];
  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto">
        {[
          ["", "Alle"],
          ["women", "Damen"],
          ["men", "Herren"],
          ["unisex", "Unisex"],
        ].map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={gender === v}
            className={`commerce-tab ${gender === v ? "selected" : ""}`}
            onClick={() => onChange("gender", v)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {roots.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`commerce-pill ${selected === c.id || current?.parent_id === c.id || (current && categories.some((x) => x.id === current.parent_id && x.parent_id === c.id)) ? "selected" : ""}`}
            onClick={() => onChange("category", selected === c.id ? "" : c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {(children.length > 0 || siblings.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(children.length ? children : siblings).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`commerce-chip ${selected === c.id ? "selected" : ""}`}
              onClick={() => onChange("category", selected === c.id ? "" : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  params,
  facets,
  counts,
  categories,
  onChange,
  onClear,
}: {
  params: URLSearchParams;
  facets: Facets;
  counts: Counts;
  categories: Category[];
  onChange: (
    key: string,
    value: string,
    extra?: Record<string, string>,
  ) => void;
  onClear: () => void;
}) {
  const chips: [string, string, string][] = [
    params.get("gender") && [
      "gender",
      params.get("gender") === "women"
        ? "Damen"
        : params.get("gender") === "men"
          ? "Herren"
          : "Unisex",
      params.get("gender") || "",
    ],
    params.get("category") && [
      "category",
      categories.find((c) => c.id === params.get("category"))?.label ||
        params.get("category") ||
        "",
      params.get("category") || "",
    ],
    params.get("brand") && ["brand", params.get("brand") || "", params.get("brand") || ""],
    params.get("size") && ["size", `Größe ${params.get("size")}`, params.get("size") || ""],
    params.get("color") && ["color", params.get("color") || "", params.get("color") || ""],
    params.get("material") && [
      "material",
      params.get("material") || "",
      params.get("material") || "",
    ],
    params.get("fit") && ["fit", params.get("fit") || "", params.get("fit") || ""],
    (params.get("min") || params.get("max")) && [
      "price",
      `${params.get("min") ? Number(params.get("min")) / 100 : "0"}–${params.get("max") ? Number(params.get("max")) / 100 : "∞"} €`,
      "",
    ],
    params.get("available") && ["available", "Nur bestellbar", "1"],
  ].filter(Boolean) as [string, string, string][];
  function setPrice(key: "min" | "max", euros: string) {
    onChange(key, euros ? String(Math.round(Number(euros) * 100)) : "");
  }
  return (
    <div className="space-y-3">
      <div className="commerce-filter-bar sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 border-y border-white/10 px-4 py-3 md:-mx-6 md:px-6">
        <FilterPanel
          label={
            params.get("sort") === "price_asc"
              ? "Preis aufsteigend"
              : params.get("sort") === "price_desc"
                ? "Preis absteigend"
                : "Neu eingetroffen"
          }
        >
          {(close) => (
            <OptionList
              options={["Neu eingetroffen", "Preis aufsteigend", "Preis absteigend"]}
              value={
                params.get("sort") === "price_asc"
                  ? "Preis aufsteigend"
                  : params.get("sort") === "price_desc"
                    ? "Preis absteigend"
                    : "Neu eingetroffen"
              }
              onPick={(label) => {
                onChange(
                  "sort",
                  label === "Preis aufsteigend"
                    ? "price_asc"
                    : label === "Preis absteigend"
                      ? "price_desc"
                      : "new",
                );
                close();
              }}
            />
          )}
        </FilterPanel>
        {(
          [
            ["size", "Größe", "sizes", false],
            ["color", "Farbe", "colors", true],
            ["brand", "Marke", "brands", false],
            ["material", "Material", "materials", false],
            ["fit", "Passform", "fits", false],
          ] as const
        ).map(([key, label, facet, swatches]) =>
          facets[facet]?.length ? (
            <FilterPanel
              key={key}
              label={params.get(key) || label}
              active={!!params.get(key)}
            >
              {(close) => (
                <OptionList
                  options={facets[facet]}
                  counts={counts[facet]}
                  value={params.get(key) || ""}
                  swatches={swatches}
                  onPick={(v) => {
                    onChange(key, v);
                    close();
                  }}
                />
              )}
            </FilterPanel>
          ) : null,
        )}
        <FilterPanel
          label="Preis"
          active={!!(params.get("min") || params.get("max"))}
        >
          {() => (
            <div className="grid grid-cols-2 gap-3">
              <label className="commerce-field">
                Von €
                <input
                  className="commerce-input w-full"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={
                    params.get("min") ? Number(params.get("min")) / 100 : ""
                  }
                  onBlur={(e) => setPrice("min", e.target.value)}
                />
              </label>
              <label className="commerce-field">
                Bis €
                <input
                  className="commerce-input w-full"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={
                    params.get("max") ? Number(params.get("max")) / 100 : ""
                  }
                  onBlur={(e) => setPrice("max", e.target.value)}
                />
              </label>
            </div>
          )}
        </FilterPanel>
        <label className="commerce-pill">
          <input
            type="checkbox"
            className="accent-primary"
            checked={params.has("available")}
            onChange={(e) => onChange("available", e.target.checked ? "1" : "")}
          />
          Nur bestellbar
        </label>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="commerce-chip selected"
              onClick={() => {
                if (key === "price") onChange("min", "", { max: "" });
                else onChange(key, "");
              }}
            >
              {label} <X size={12} />
            </button>
          ))}
          <button type="button" className="text-xs underline" onClick={onClear}>
            Alle zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
