/**
 * Backfill: KI-Kategorisierung fuer bestehende Produkte nachholen.
 *
 * Findet Per-Foto-Produkte (source_url enthaelt "#") mit ai_status
 * 'pending'/'error' (oder leer + ohne gender) und analysiert das Foto
 * erneut mit Gemini. Bereits kategorisierte Produkte (ai_status='ok')
 * werden automatisch uebersprungen.
 *
 * Usage (auf dem VPS):
 *   docker exec fashion-supply-app-1 node --import tsx scripts/categorize-products.ts [--limit=50]
 */
import { and, eq, like, or } from "drizzle-orm";
import { db, ensureDb, products } from "../src/lib/server/db";
import { upsertPhotoProduct } from "../src/lib/server/products";

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set — nothing to do.");
    process.exit(1);
  }

  await ensureDb();
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        or(
          eq(products.aiStatus, "pending"),
          eq(products.aiStatus, "error"),
          and(eq(products.aiStatus, ""), eq(products.gender, ""))
        ),
        like(products.sourceUrl, "%#%")
      )
    )
    .limit(limit);

  console.log(`Found ${rows.length} products to categorize (limit ${limit}).`);
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    const idx = row.sourceUrl.lastIndexOf("#");
    if (idx < 0 || !row.imageUrl) {
      failed++;
      continue;
    }
    try {
      const { row: updated } = await upsertPhotoProduct({
        albumUrl: row.sourceUrl.slice(0, idx),
        photoUrl: row.imageUrl,
        photoId: row.sourceUrl.slice(idx + 1),
        albumTitle: row.title,
        seller: row.seller || "",
      });
      ok++;
      console.log(`OK   #${row.id}  ${updated.title}  [${updated.gender}/${updated.subcategory || updated.category}]`);
    } catch (err) {
      failed++;
      console.log(`FAIL #${row.id} — ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`Done: ${ok} categorized, ${failed} failed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
