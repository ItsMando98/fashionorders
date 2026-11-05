import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";
import { ensureSchema } from "../src/lib/server/schema-init";
import { categories } from "../src/lib/commerce/taxonomy";
export async function migrateCommerce(url: string, bootstrap = false) {
  const sql = postgres(url, { max: 1 });
  try {
    if (bootstrap) await ensureSchema(sql);
    await sql`CREATE TABLE IF NOT EXISTS shop_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(716230001)`;
      for (const file of fs
        .readdirSync(path.resolve("migrations"))
        .filter((f) => /^\d+.*\.sql$/.test(f))
        .sort()) {
        const source = fs.readFileSync(
          path.resolve("migrations", file),
          "utf8",
        );
        const checksum = crypto
          .createHash("sha256")
          .update(source)
          .digest("hex");
        const [old] =
          await tx`SELECT checksum FROM shop_migrations WHERE version=${file}`;
        if (old) {
          if (old.checksum !== checksum)
            throw new Error(`Migration checksum mismatch: ${file}`);
          continue;
        }
        await tx.unsafe(source);
        await tx`INSERT INTO shop_migrations(version,checksum) VALUES(${file},${checksum})`;
      }
      for (const [id, parent, label] of categories)
        await tx`INSERT INTO shop_categories(id,parent_id,label) VALUES(${id},${parent},${label}) ON CONFLICT(id) DO UPDATE SET label=excluded.label`;
    });
  } finally {
    await sql.end();
  }
}
if (process.argv[1]?.endsWith("migrate-commerce.ts")) {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url)
    throw new Error(
      "MIGRATION_DATABASE_URL is required. Never implicitly use the production DATABASE_URL.",
    );
  migrateCommerce(url, process.argv.includes("--bootstrap"))
    .then(() => console.log("Commerce migrations applied."))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
