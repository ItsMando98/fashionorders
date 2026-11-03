/**
 * Seller-Scraper (Backend): sammelt die Album-URLs eines Yupoo-Sellers und
 * legt sie als Produkte im globalen Katalog an. Wird vom Cron-Scheduler
 * (scheduler.ts), von der Admin-API ("Run now") und vom CLI-Skript
 * scripts/scrape-seller.ts gemeinsam genutzt.
 */
import * as cheerio from "cheerio";
import { desc, eq } from "drizzle-orm";
import { db, ensureDb, scrapeSources, type ScrapeSourceRow } from "./db";
import { scrapeToProduct } from "./products";
import type { ScrapeSource } from "@/lib/types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Zeitstempel im App-Format (TEXT, UTC): "YYYY-MM-DD HH:MM:SS"
const nowUtc = () => new Date().toISOString().slice(0, 19).replace("T", " ");

// Liest die Album-Liste eines Sellers (paginiert) und sammelt Album-URLs.
export async function collectAlbumUrls(sellerBase: string, maxPages = 3): Promise<string[]> {
  const found = new Set<string>();
  const base = sellerBase.replace(/\/$/, "");
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`${base}/albums?page=${page}`, {
      headers: { "User-Agent": USER_AGENT, Referer: base },
    });
    if (!res.ok) break; // Seite nicht erreichbar -> abbrechen
    const html = await res.text();
    const $ = cheerio.load(html);
    const before = found.size;
    $("a[href*='/albums/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const m = href.match(/\/albums\/(\d+)/);
      if (m) found.add(`${base}/albums/${m[1]}`);
    });
    if (found.size === before) break; // keine neuen Alben -> letzte Seite erreicht
  }
  return [...found];
}

export interface ScrapeRunResult {
  total: number; // gefundene Alben (nach Limit)
  added: number; // erfolgreich angelegt/aktualisiert
  failed: number; // fehlgeschlagen
}

// Scraped bis zu `limit` Alben eines Sellers in den Produktkatalog.
// Dedupe laeuft in scrapeToProduct ueber die unique source_url.
export async function scrapeSellerAlbums(sellerUrl: string, limit: number): Promise<ScrapeRunResult> {
  await ensureDb();
  const albumUrls = (await collectAlbumUrls(sellerUrl)).slice(0, limit);
  let added = 0;
  let failed = 0;
  for (const url of albumUrls) {
    try {
      await scrapeToProduct(url);
      added++;
    } catch (err) {
      failed++;
      console.warn(`[seller-scraper] FAIL ${url} —`, err instanceof Error ? err.message : err);
    }
  }
  return { total: albumUrls.length, added, failed };
}

// Fuehrt einen kompletten Lauf fuer eine konfigurierte Quelle aus und
// schreibt Status/Zeitpunkt/Ergebnis zurueck in scrape_sources.
export async function runScrapeSource(source: ScrapeSourceRow): Promise<ScrapeRunResult> {
  await ensureDb();
  await db
    .update(scrapeSources)
    .set({ lastStatus: "running", updatedAt: nowUtc() })
    .where(eq(scrapeSources.id, source.id));
  try {
    const result = await scrapeSellerAlbums(source.sellerUrl, source.perRunLimit);
    await db
      .update(scrapeSources)
      .set({
        lastRunAt: nowUtc(),
        lastStatus: "ok",
        lastMessage: `${result.added} added/updated, ${result.failed} failed (${result.total} albums)`,
        lastAdded: result.added,
        updatedAt: nowUtc(),
      })
      .where(eq(scrapeSources.id, source.id));
    return result;
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await db
      .update(scrapeSources)
      .set({ lastRunAt: nowUtc(), lastStatus: "error", lastMessage: msg, updatedAt: nowUtc() })
      .where(eq(scrapeSources.id, source.id));
    throw err;
  }
}

export async function listScrapeSources(): Promise<ScrapeSourceRow[]> {
  await ensureDb();
  return db.select().from(scrapeSources).orderBy(desc(scrapeSources.id));
}

export async function getScrapeSource(id: number): Promise<ScrapeSourceRow | null> {
  await ensureDb();
  const [row] = await db.select().from(scrapeSources).where(eq(scrapeSources.id, id)).limit(1);
  return row ?? null;
}

// API-Shape (snake_case) fuer das Admin-Frontend.
export function toScrapeSource(row: ScrapeSourceRow): ScrapeSource {
  return {
    id: row.id,
    seller_url: row.sellerUrl,
    label: row.label || "",
    interval_hours: row.intervalHours,
    per_run_limit: row.perRunLimit,
    active: row.active,
    last_run_at: row.lastRunAt,
    last_status: row.lastStatus,
    last_message: row.lastMessage || "",
    last_added: row.lastAdded,
    created_at: row.createdAt,
  };
}
