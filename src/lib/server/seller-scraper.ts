/**
 * Seller-Scraper (Backend): sammelt die Album-URLs eines Yupoo-Sellers und
 * legt sie als Produkte im globalen Katalog an. Wird vom Cron-Scheduler
 * (scheduler.ts), von der Admin-API ("Run now") und vom CLI-Skript
 * scripts/scrape-seller.ts gemeinsam genutzt.
 */
import * as cheerio from "cheerio";
import { desc, eq } from "drizzle-orm";
import { db, ensureDb, scrapeSources, type ScrapeSourceRow } from "./db";
import { scrapeToProduct, sellerFromUrl, upsertPhotoProduct } from "./products";
import type { ScrapeSource } from "@/lib/types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Zeitstempel im App-Format (TEXT, UTC): "YYYY-MM-DD HH:MM:SS"
const nowUtc = () => new Date().toISOString().slice(0, 19).replace("T", " ");

// Normalisiert beliebige Seller-URLs (…/categories, …/albums, mit/ohne Slash)
// auf die Basis-URL, z.B. "https://happywhale.x.yupoo.com".
export function sellerBaseUrl(url: string): string {
  const m = url.trim().match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : url.trim().replace(/\/$/, "");
}

// Sammelt Album-IDs aus einer bereits geladenen Seite.
function extractAlbumIds($: cheerio.CheerioAPI): string[] {
  const ids: string[] = [];
  $("a[href*='/albums/']").each((_, a) => {
    const m = ($(a).attr("href") || "").match(/\/albums\/(\d+)/);
    if (m) ids.push(m[1]);
  });
  return ids;
}

// Liest die Album-Listen eines Sellers und sammelt Album-URLs (1 Album = 1 Produkt).
// Funktioniert mit jeder Seller-URL (Basis, /categories oder /albums):
//   1. /categories laden -> alle Kategorie-IDs sammeln
//   2. /albums + jede Kategorie-Seite paginiert durchgehen
// Stoppt fruehzeitig, sobald `limit` Alben gefunden sind (neueste zuerst).
export async function collectAlbumUrls(sellerUrl: string, limit = 100, maxPagesPerList = 10): Promise<string[]> {
  const base = sellerBaseUrl(sellerUrl);
  const headers = { "User-Agent": USER_AGENT, Referer: base };
  const found = new Set<string>();

  // 1) Kategorien des Sellers sammeln (/categories-Seite)
  const categoryIds = new Set<string>();
  try {
    const res = await fetch(`${base}/categories`, { headers });
    if (res.ok) {
      const $ = cheerio.load(await res.text());
      $("a[href*='/categories/']").each((_, a) => {
        const m = ($(a).attr("href") || "").match(/\/categories\/(\d+)/);
        if (m) categoryIds.add(m[1]);
      });
    }
  } catch {
    // keine Kategorien erreichbar -> nur /albums verwenden
  }

  // 2) Albumlisten durchgehen: erst /albums (Gesamtuebersicht), dann jede Kategorie
  const listUrls = [
    `${base}/albums`,
    ...[...categoryIds].slice(0, 50).map((id) => `${base}/categories/${id}`),
  ];
  for (const listUrl of listUrls) {
    if (found.size >= limit) break;
    for (let page = 1; page <= maxPagesPerList; page++) {
      let res: Response;
      try {
        res = await fetch(`${listUrl}?page=${page}`, { headers });
      } catch {
        break; // Netzwerkfehler -> naechste Liste
      }
      if (!res.ok) break; // Seite nicht erreichbar -> letzte Seite der Liste
      const $ = cheerio.load(await res.text());
      const before = found.size;
      for (const id of extractAlbumIds($)) found.add(`${base}/albums/${id}`);
      if (found.size === before) break; // keine neuen Alben -> letzte Seite erreicht
      if (found.size >= limit) break;
    }
  }
  // Neueste Alben zuerst (Yupoo listet absteigend), auf limit kuerzen
  return [...found].slice(0, limit);
}

export interface ScrapeRunResult {
  total: number; // gefundene Alben (nach Limit)
  added: number; // erfolgreich angelegt/aktualisiert
  failed: number; // fehlgeschlagen
}

// ---------------------------------------------------------------------------
// Per-Foto-Modus: JEDES Foto eines Albums wird ein eigenes Produkt und (mit
// Gemini-Key) per KI benannt + kategorisiert (Gender/Kategorie/Brand).
// ---------------------------------------------------------------------------

export interface AlbumPhoto {
  id: string; // stabile ID aus der Foto-URL (Dedupe-Anker)
  url: string; // volle Foto-URL (photo.yupoo.com)
}

// Laedt eine Album-Seite und extrahiert Album-Titel + alle Fotos.
// Yupoo-Albenseiten liefern Fotos als data-origin-src (Full-Res) / data-src.
export async function extractAlbumPhotos(
  albumUrl: string,
  maxPhotos = 50
): Promise<{ title: string; photos: AlbumPhoto[] }> {
  // Album-Detailseiten brauchen ?uid=1, sonst 404 (verifiziert 2026-11)
  const fetchUrl = /[?&]uid=/.test(albumUrl)
    ? albumUrl
    : `${albumUrl}${albumUrl.includes("?") ? "&" : "?"}uid=1`;
  const res = await fetch(fetchUrl, {
    headers: { "User-Agent": USER_AGENT, Referer: sellerBaseUrl(albumUrl) },
  });
  if (!res.ok) throw new Error(`album page HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());

  const albumId = albumUrl.match(/albums\/(\d+)/)?.[1] || "album";
  const title =
    $(".showalbumheader__gallerytitle").first().text().trim() || `Yupoo Album #${albumId}`;

  const photos: AlbumPhoto[] = [];
  const seen = new Set<string>();
  $("[data-origin-src], [data-src]").each((_, el) => {
    // Full-Res bevorzugen; Thumbnails (…/big.jpg, …/square.jpg) ueberspringen
    const raw = ($(el).attr("data-origin-src") || "").trim() || ($(el).attr("data-src") || "").trim();
    if (!raw || raw.startsWith("data:")) return;
    const url = raw.startsWith("//") ? `https:${raw}` : raw;
    if (!url.includes("photo.yupoo.com")) return;
    // ID = letzte zwei Pfadsegmente ohne Extension (z.B. "35227535_451e0536")
    const id = url
      .split("/")
      .slice(-2)
      .join("_")
      .replace(/\.\w+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    photos.push({ id, url });
  });

  return { title, photos: photos.slice(0, maxPhotos) };
}

// Scraped EIN Album im Per-Foto-Modus. Gibt die Zahl der Produkte zurueck.
// Fallback: Album ohne Fotos -> klassischer 1-Album-1-Produkt-Scrape.
export async function scrapeAlbumToProducts(albumUrl: string): Promise<number> {
  const { title, photos } = await extractAlbumPhotos(albumUrl);
  if (photos.length === 0) {
    await scrapeToProduct(albumUrl);
    return 1;
  }
  const seller = sellerFromUrl(albumUrl);
  let count = 0;
  for (const photo of photos) {
    try {
      await upsertPhotoProduct({
        albumUrl,
        photoUrl: photo.url,
        photoId: photo.id,
        albumTitle: title,
        seller,
      });
      count++;
    } catch (err) {
      console.warn(`[seller-scraper] photo FAIL ${photo.url} —`, err instanceof Error ? err.message : err);
    }
  }
  return count;
}

// Scraped bis zu `limit` Alben eines Sellers in den Produktkatalog (Per-Foto-Modus).
// Dedupe laeuft ueber die unique source_url (album#foto bzw. album).
export async function scrapeSellerAlbums(sellerUrl: string, limit: number): Promise<ScrapeRunResult> {
  await ensureDb();
  const albumUrls = await collectAlbumUrls(sellerUrl, limit);
  let added = 0;
  let failed = 0;
  for (const url of albumUrls) {
    try {
      added += await scrapeAlbumToProducts(url);
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
