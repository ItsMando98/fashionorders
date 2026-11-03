import postgres, { type Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { ensureSchema } from "./schema-init";

// Supabase Postgres (self-hosted auf dem VPS). Lokal kann DATABASE_URL
// auf denselben Server zeigen; Fallback ist localhost.
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/postgres";

let client: Sql | null = null;
let initPromise: Promise<void> | null = null;

export function getSql(): Sql {
  if (!client) {
    client = postgres(DATABASE_URL, {
      max: 10,
      prepare: true,
    });
  }
  return client;
}

// Muss einmal vor den ersten Queries aufgerufen werden: legt Tabellen an
// und fuehrt kleine Migrationen aus. Laeuft genau einmal pro Prozess.
export function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = ensureSchema(getSql()).catch((err) => {
      initPromise = null; // naechster Aufruf darf es erneut versuchen
      throw err;
    });
  }
  return initPromise;
}

// Typed Drizzle ORM instance (async, postgres-js driver)
export const db = drizzle(getSql(), { schema });

export function getDb() {
  return db;
}

export * from "./schema";
