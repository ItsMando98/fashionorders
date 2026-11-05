// Frontend: small helpers so product cards and filters can show a colour
// swatch and a "Neu" badge without extra backend work.

const NAMED: Record<string, string> = {
  schwarz: "#111111",
  black: "#111111",
  weiß: "#f4f4f4",
  weiss: "#f4f4f4",
  white: "#f4f4f4",
  grau: "#8a8a8a",
  grey: "#8a8a8a",
  gray: "#8a8a8a",
  anthrazit: "#3a3a3a",
  navy: "#1c2b4a",
  blau: "#2a4d9b",
  blue: "#2a4d9b",
  hellblau: "#7eb6d9",
  rot: "#b42318",
  red: "#b42318",
  bordeaux: "#6b1c23",
  grün: "#2f6b3a",
  gruen: "#2f6b3a",
  green: "#2f6b3a",
  olive: "#5c6b3a",
  khaki: "#8a7a4a",
  beige: "#cbb89a",
  cream: "#efe6d2",
  creme: "#efe6d2",
  braun: "#6b4226",
  brown: "#6b4226",
  cognac: "#8a4b24",
  pink: "#e38bb3",
  rosa: "#e38bb3",
  lila: "#6b4c9a",
  purple: "#6b4c9a",
  gelb: "#e2c44d",
  yellow: "#e2c44d",
  orange: "#e36a1a",
  gold: "#c6a04a",
  silber: "#c0c4c8",
  silver: "#c0c4c8",
};

export function colorHex(name: string): string {
  const key = name.trim().toLowerCase();
  if (NAMED[key]) return NAMED[key];
  const first = key.split(/[\s/]+/)[0];
  return NAMED[first] || "";
}

export function isNewArrival(createdAt: unknown): boolean {
  if (!createdAt) return false;
  const time = new Date(String(createdAt)).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time < 21 * 24 * 60 * 60 * 1000;
}

export function uniqueColors(variants: { color?: string }[] = []): string[] {
  return [
    ...new Set(variants.map((v) => String(v.color || "").trim()).filter(Boolean)),
  ];
}
