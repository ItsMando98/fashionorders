import crypto from "node:crypto";
import postgres, { type Sql } from "postgres";
// Dedicated client: Drizzle changes JSON serializers on its own postgres-js client.
let client: Sql | null = null;
export async function closeCommerce() {
  if (client) {
    await client.end();
    client = null;
  }
}
import { PublicError } from "../server/http";
import type { User } from "../types";
export type Row = Record<string, any>;
export function enabled() {
  return process.env.SHOP_V2_ENABLED === "1";
}
export function database(): Sql {
  if (!enabled())
    throw new PublicError("Der neue Shop ist noch nicht freigeschaltet.", 503);
  return (client ??= postgres(
    process.env.DATABASE_URL ||
      "postgres://postgres:postgres@127.0.0.1:5432/postgres",
    { max: 10, prepare: false },
  ));
}
export async function transaction<T>(
  callback: (tx: Sql) => Promise<T>,
): Promise<T> {
  return (await database().begin((tx) => callback(tx as unknown as Sql))) as T;
}
export function requireAdmin(user: User) {
  if (user.role !== "admin")
    throw new PublicError("Admin-Zugriff erforderlich.", 403);
}
export function hash(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
export async function event(
  tx: Sql,
  user: User,
  orderId: number | null,
  type: string,
  data: Row = {},
) {
  await tx`INSERT INTO shop_events(order_id,actor_id,type,data) VALUES(${orderId},${user.id},${type},${tx.json(data)})`;
  await tx`INSERT INTO shop_jobs(user_id,kind,payload) VALUES(${user.id},'notify',${tx.json({ order_id: orderId, type })})`;
}
export async function ownOrder(
  tx: Sql,
  user: User,
  id: number,
  lock = false,
): Promise<Row> {
  const rows = lock
    ? await tx`SELECT * FROM shop_orders WHERE id=${id} FOR UPDATE`
    : await tx`SELECT * FROM shop_orders WHERE id=${id}`;
  const row = rows[0];
  if (!row || (row.user_id !== user.id && user.role !== "admin"))
    throw new PublicError("Bestellung nicht gefunden.", 404);
  return row;
}
export async function settings(
  tx = database(),
): Promise<Record<string, string>> {
  const rows = await tx`SELECT key,value FROM settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
export function publicAddress(value: Row) {
  return {
    name: String(value.name || "").slice(0, 120),
    street: String(value.street || "").slice(0, 200),
    zip: String(value.zip || "").slice(0, 20),
    city: String(value.city || "").slice(0, 120),
    country: String(value.country || "")
      .toUpperCase()
      .slice(0, 2),
  };
}
export function assertAddress(
  address: ReturnType<typeof publicAddress>,
  countries: string[],
) {
  if (
    Object.values(address).some((x) => !x.trim()) ||
    !countries.includes(address.country)
  )
    throw new PublicError(
      "Vollständige Adresse und freigegebenes Lieferland erforderlich.",
    );
}
