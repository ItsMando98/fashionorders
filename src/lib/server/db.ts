import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const DB_PATH = path.resolve(process.cwd(), "fashion_orders.db");

// Singleton Better-SQLite3 connection
let sqliteInstance: Database.Database | null = null;

export function getSqlite(): Database.Database {
  if (!sqliteInstance) {
    sqliteInstance = new Database(DB_PATH);
    sqliteInstance.pragma("journal_mode = WAL");
  }
  return sqliteInstance;
}

// Export typed Drizzle ORM instance
export const db = drizzle(getSqlite(), { schema });

// Helper to access raw or drizzle
export function getDb() {
  return db;
}

export * from "./schema";
