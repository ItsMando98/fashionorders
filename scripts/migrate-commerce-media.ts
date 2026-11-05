import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { storageRequest } from "../src/lib/commerce/storage";
async function main() {
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error("MIGRATION_DATABASE_URL required");
  const sql = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1 });
  try {
    const rows =
      await sql`SELECT m.*,p.visibility FROM shop_media m JOIN products p ON p.id=m.product_id WHERE m.bucket='legacy' ORDER BY m.id`;
    let migrated = 0;
    for (const m of rows) {
      if (!process.argv.includes("--apply")) continue;
      const bytes = await fs.readFile(
        path.join(
          process.env.FASHION_ORDERS_CACHE || ".cache_images",
          path.basename(m.object_path),
        ),
      );
      const type =
        bytes[0] === 0xff && bytes[1] === 0xd8
          ? "image/jpeg"
          : bytes.toString("ascii", 0, 4) === "RIFF"
            ? "image/webp"
            : "image/png";
      const bucket =
          m.visibility === "private"
            ? process.env.STORAGE_PRIVATE_BUCKET || "fashion-private"
            : process.env.STORAGE_CATALOG_BUCKET || "fashion-catalog",
        objectPath = `legacy/${m.product_id}/${path.basename(m.object_path)}`;
      await storageRequest(`/object/${bucket}/${objectPath}`, {
        method: "POST",
        headers: { "Content-Type": type, "x-upsert": "true" },
        body: new Uint8Array(bytes),
      });
      await sql`UPDATE shop_media SET bucket=${bucket},object_path=${objectPath} WHERE id=${m.id} AND bucket='legacy'`;
      migrated++;
    }
    console.log(
      JSON.stringify({
        mode: process.argv.includes("--apply") ? "applied" : "dry-run",
        pending: rows.length,
        migrated,
      }),
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
