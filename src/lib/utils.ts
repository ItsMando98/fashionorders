import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEUR(cny: number | null | undefined, rate: number = 0.13): string {
  if (cny === null || cny === undefined || isNaN(Number(cny))) return "€ —";
  const eur = Number(cny) * rate;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(eur);
}

export function formatCNY(cny: number | null | undefined): string {
  if (cny === null || cny === undefined || isNaN(Number(cny))) return "¥ —";
  return `¥${Number(cny).toFixed(0)}`;
}

export function parseSizeChips(availStr?: string): string[] {
  if (!availStr || availStr === "See album") return [];
  const raw = availStr
    .replace(/Size\s*[:：]?/gi, "")
    .split(/[,/|]+|\s{2,}/)
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 24);
  if (raw.length === 1 && raw[0].includes("-")) {
    const m = raw[0].match(/^(\d{2})-(\d{2})$/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      if (end > start && end - start <= 12) {
        const range: string[] = [];
        for (let i = start; i <= end; i++) range.push(String(i));
        return range;
      }
    }
    if (/^S-X+L$/i.test(raw[0]) || /^M-3XL/i.test(raw[0])) {
      return ["S", "M", "L", "XL", "2XL", "3XL"];
    }
  }
  if (raw.length === 1 && /^\d+\.\d+\.\d+/.test(raw[0])) {
    return raw[0].split(".").filter(Boolean);
  }
  return raw.slice(0, 10);
}
