/**
 * Einmalige Datenmigration: lokale SQLite-Datei -> Supabase Postgres.
 *
 * Aufruf:
 *   DATABASE_URL=postgres://postgres:<pass>@127.0.0.1:5432/postgres \
 *     npx tsx scripts/migrate-sqlite-to-pg.ts
 *
 * - Liest fashion_orders.db (oder FASHION_ORDERS_DB) mit better-sqlite3.
 * - Legt das Schema per ensureSchema() an (idempotent).
 * - Kopiert alle Tabellen mit festen IDs (ON CONFLICT DO NOTHING -> wiederholbar).
 * - Setzt danach die SERIAL-Sequenzen auf MAX(id).
 */
import path from "path";
import Database from "better-sqlite3";
import postgres from "postgres";
import { ensureSchema } from "../src/lib/server/schema-init";

const SQLITE_PATH = process.env.FASHION_ORDERS_DB
  ? path.resolve(process.env.FASHION_ORDERS_DB)
  : path.resolve(process.cwd(), "fashion_orders.db");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL fehlt (Ziel-Postgres).");
  process.exit(1);
}

// Reihenfolge wegen Fremdschluesseln
const TABLES = [
  "users",
  "settings",
  "sessions",
  "items",
  "order_shares",
  "login_codes",
  "gram_posts",
  "gram_looks",
  "gram_look_items",
  "gram_messages",
  "gram_invites",
  "gram_follows",
  "gram_likes",
  "gram_comments",
  "gram_saved",
  "gram_stories",
  "gram_notifications",
  "gram_reels",
];

const SERIAL_TABLES = [
  "users",
  "items",
  "order_shares",
  "login_codes",
  "gram_posts",
  "gram_looks",
  "gram_messages",
  "gram_invites",
  "gram_comments",
  "gram_stories",
  "gram_notifications",
  "gram_reels",
];

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const sql = postgres(DATABASE_URL as string, { max: 4 });

  console.log("Lege Schema in Postgres an ...");
  await ensureSchema(sql);

  for (const table of TABLES) {
    const existing = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table);
    if (!existing) {
      console.log(`- ${table}: in SQLite nicht vorhanden, uebersprungen`);
      continue;
    }
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    if (rows.length === 0) {
      console.log(`- ${table}: 0 Zeilen`);
      continue;
    }
    const columns = Object.keys(rows[0]);
    let inserted = 0;
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const result = await sql`
        INSERT INTO ${sql(table)} ${sql(chunk, ...columns)}
        ON CONFLICT DO NOTHING
      `;
      inserted += result.count;
    }
    console.log(`- ${table}: ${inserted}/${rows.length} Zeilen kopiert`);
  }

  console.log("Setze Sequenzen ...");
  for (const table of SERIAL_TABLES) {
    await sql.unsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
    );
  }

  await sql.end();
  sqlite.close();
  console.log("Migration fertig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
