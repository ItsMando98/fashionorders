import { PublicError } from "../server/http";
export function integer(value: unknown, min = 1, max = 2147483647): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new PublicError("Ungültiger ganzzahliger Wert.");
  return n;
}
export function decimal(value: unknown, scale: number): bigint {
  const s = String(value);
  if (!/^\d+(\.\d+)?$/.test(s))
    throw new PublicError("Ungültiger Dezimalbetrag.");
  const [whole, fraction = ""] = s.split(".");
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale)))
    throw new PublicError("Zu viele Nachkommastellen.");
  return (
    BigInt(whole) * BigInt(10) ** BigInt(scale) +
    BigInt(fraction.slice(0, scale).padEnd(scale, "0") || "0")
  );
}
export function cents(value: unknown): number {
  return integer(decimal(value, 2).toString(), 0, 100000000);
}
export function atomAmount(
  totalCents: number,
  eurRate: string,
  precision: number,
): string {
  integer(totalCents, 1, 100000000);
  integer(precision, 0, 18);
  const rate = decimal(eurRate, 12);
  if (rate <= BigInt(0)) throw new PublicError("Ungültiger Kurs.");
  const numerator = BigInt(totalCents) * BigInt(10) ** BigInt(precision + 12);
  const denominator = BigInt(100) * rate;
  return ((numerator + denominator - BigInt(1)) / denominator).toString();
}
export function formatAtoms(atoms: string, precision: number): string {
  const s = BigInt(atoms)
    .toString()
    .padStart(precision + 1, "0");
  return precision ? `${s.slice(0, -precision)}.${s.slice(-precision)}` : s;
}
export function saleCents(
  purchaseFen: unknown,
  rate: string,
  fixedCents: number,
  percent: string,
  haulPercent = "0",
): number | null {
  if (purchaseFen === null || purchaseFen === undefined) return null;
  const base =
    (BigInt(String(purchaseFen)) * decimal(rate, 10) + BigInt(5000000000)) /
    BigInt(10000000000);
  const pct = (base * decimal(percent, 4) + BigInt(500000)) / BigInt(1000000);
  const subtotal = base + pct + BigInt(fixedCents);
  const haul =
    (subtotal * decimal(haulPercent, 4) + BigInt(500000)) / BigInt(1000000);
  return integer((subtotal + haul).toString(), 1, 100000000);
}
export function customerFen(sale: number, rate: string): number {
  const r = decimal(rate, 10);
  if (!r) throw new PublicError("Ungültiger Wechselkurs.");
  return integer(
    ((BigInt(sale) * BigInt(10000000000) + r / BigInt(2)) / r).toString(),
    0,
    10000000000,
  );
}
