import { desc, eq, and, ilike, or, sql } from "drizzle-orm";
import { db, ensureDb, products } from "./db";
import type { ProductRow } from "./schema";
import { scrapeAnyUrl, downloadAndCacheThumbnail } from "./scraper";
import { categorizeProductImage, geminiEnabled } from "./categorize";
import { getFeeSettings, priceLine } from "./pricing";
import { PublicError } from "./http";
import type { AdminProduct, PublicProduct, User, FeeSettings } from "@/lib/types";

// ---------------------------------------------------------------------------
// Produktkatalog: globale Produkte (1 Zeile pro gescraptem Artikel).
// Seller / source_url / weidian_url sind ADMIN-ONLY.
// ---------------------------------------------------------------------------

// Kunden-Sicht: Seller-Felder werden strikt entfernt.
export function toPublicProduct(row: ProductRow, feeSettings: FeeSettings, memberUser: User | null = null): PublicProduct {
  const priced = priceLine(row.priceCny, 1, memberUser, feeSettings);
  return {
    id: row.id,
    title: row.title,
    brand: row.brand || "—",
    category: row.category || "Apparel / Item",
    available_sizes: row.availableSizes || "",
    description: row.description || "",
    price_cny: priced.price_cny,
    price_eur: row.priceCny !== null ? priced.final_unit_eur : null,
    image_url: row.imageUrl || "",
    local_image: row.localImage || "",
    source_platform: row.sourcePlatform || "Yupoo",
    gender: row.gender || "",
    subcategory: row.subcategory || "",
    active: row.active,
    created_at: row.createdAt,
  };
}

// Admin-Sicht: inkl. Seller + Quell-URLs (fuer die Weiterleitung an Seller).
export function toAdminProduct(row: ProductRow, feeSettings: FeeSettings, memberUser: User | null = null): AdminProduct {
  return {
    ...toPublicProduct(row, feeSettings, memberUser),
    seller: row.seller || "",
    source_url: row.sourceUrl || "",
    weidian_url: row.weidianUrl || "",
    ai_status: row.aiStatus || "",
  };
}

// Seller-Name aus einer Yupoo-/Weidian-URL ableiten (Subdomain oder Pfad).
export function sellerFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.toLowerCase();
    if (host.endsWith("yupoo.com")) {
      const sub = host.replace(/\.?x\.yupoo\.com$/, "").replace(/\.?yupoo\.com$/, "");
      if (sub && sub !== "www" && sub !== "m") return sub;
    }
    if (host.endsWith("weidian.com")) {
      const m = u.search.match(/userid=(\d+)/i);
      if (m) return `weidian_${m[1]}`;
      return "weidian";
    }
    return host;
  } catch {
    return "";
  }
}

// Scraped eine URL und legt das Produkt im Katalog an (Dedupe ueber source_url).
// Existiert die URL schon, wird das bestehende Produkt aktualisiert.
export async function scrapeToProduct(url: string, sellerOverride?: string): Promise<ProductRow> {
  await ensureDb();
  const feeSettings = await getFeeSettings();
  const scraped = await scrapeAnyUrl(url, feeSettings.cny_to_eur);

  const sourceUrl = scraped.url || url;
  const seller = (sellerOverride || sellerFromUrl(sourceUrl) || "").slice(0, 120);

  const values = {
    title: String(scraped.title || "Untitled Product").slice(0, 300),
    brand: scraped.brand || "—",
    category: scraped.category || "Apparel / Item",
    availableSizes: scraped.available_sizes || "",
    description: "",
    priceCny: scraped.price_cny ?? null,
    imageUrl: "",
    localImage: scraped.local_image || "",
    sourcePlatform: scraped.source_platform || "Yupoo",
    seller,
    sourceUrl,
    weidianUrl: scraped.weidian_url || "",
    updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  };

  // Dedupe: gleiche Quell-URL -> Update statt Duplikat.
  // WICHTIG: "active" wird beim Update NICHT angefasst, damit im Admin
  // deaktivierte/geloeschte Produkte beim naechsten Scrape nicht
  // still wieder aktiviert werden.
  if (sourceUrl) {
    const existing = (
      await db.select().from(products).where(eq(products.sourceUrl, sourceUrl))
    )[0];
    if (existing) {
      const updated = (
        await db
          .update(products)
          .set(values)
          .where(eq(products.id, existing.id))
          .returning()
      )[0];
      return updated;
    }
  }

  const inserted = (await db.insert(products).values({ ...values, active: 1 }).returning())[0];
  return inserted;
}

// ---------------------------------------------------------------------------
// Per-Foto-Produkte: ein Foto aus einem Seller-Album wird EIN Produkt.
// source_url = "<albumUrl>#<photoId>" (dedupe-stabil, im Seller-Sheet lesbar).
// ---------------------------------------------------------------------------
export interface PhotoProductInput {
  albumUrl: string; // z.B. https://seller.x.yupoo.com/albums/123
  photoUrl: string; // z.B. https://photo.yupoo.com/seller/hash/abc.jpg
  photoId: string; // stabiler Teil aus photoUrl (letztes Pfadsegment)
  albumTitle: string; // Kontext fuer Fallback-Titel
  seller: string;
}

export async function upsertPhotoProduct(input: PhotoProductInput): Promise<{ row: ProductRow; created: boolean }> {
  await ensureDb();
  const sourceUrl = `${input.albumUrl}#${input.photoId}`;
  const nowUtc = () => new Date().toISOString().slice(0, 19).replace("T", " ");

  const existing = (await db.select().from(products).where(eq(products.sourceUrl, sourceUrl)))[0];
  // Schon kategorisiert -> nichts tun (Kosten sparen, Daten stabil)
  if (existing && existing.aiStatus === "ok") return { row: existing, created: false };

  // 1) Foto analysieren (nur wenn Gemini-Key gesetzt; sonst pending)
  const ai = geminiEnabled() ? await categorizeProductImage(input.photoUrl, input.albumUrl) : null;

  // 2) Foto lokal cachen (wie beim klassischen Scrape)
  let localImage = existing?.localImage || "";
  if (!localImage) {
    try {
      localImage = await downloadAndCacheThumbnail(
        input.photoUrl,
        input.albumUrl,
        `prod_${input.photoId}`
      );
    } catch {
      // Bild-Cache ist nice-to-have, kein Abbruchgrund
    }
  }

  const values = {
    title: (ai?.title || `${input.albumTitle} · ${input.photoId}`).slice(0, 300),
    brand: ai?.brand || existing?.brand || "—",
    category: ai?.category || existing?.category || "Apparel / Item",
    availableSizes: existing?.availableSizes || "Standard Sizes",
    description: ai?.color ? `Color: ${ai.color}` : existing?.description || "",
    priceCny: existing?.priceCny ?? null, // Preis pflegt der Admin nach
    imageUrl: input.photoUrl,
    localImage,
    sourcePlatform: "Yupoo",
    seller: input.seller.slice(0, 120),
    sourceUrl,
    weidianUrl: existing?.weidianUrl || "",
    gender: ai?.gender || existing?.gender || "",
    subcategory: ai?.subcategory || existing?.subcategory || "",
    aiStatus: ai ? "ok" : geminiEnabled() ? "error" : "pending",
    active: existing?.active ?? 1,
    updatedAt: nowUtc(),
  };

  if (existing) {
    const updated = (await db.update(products).set(values).where(eq(products.id, existing.id)).returning())[0];
    return { row: updated, created: false };
  }
  const inserted = (await db.insert(products).values(values).returning())[0];
  return { row: inserted, created: true };
}

export interface ProductListQuery {
  search?: string;
  category?: string;
  brand?: string;
  gender?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export async function listProducts(q: ProductListQuery): Promise<{ rows: ProductRow[]; total: number }> {
  await ensureDb();
  const page = Math.max(1, q.page || 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize || 24));

  const conditions = [];
  if (!q.includeInactive) conditions.push(eq(products.active, 1));
  if (q.search) {
    const like = `%${q.search}%`;
    conditions.push(or(ilike(products.title, like), ilike(products.brand, like))!);
  }
  if (q.category) conditions.push(eq(products.category, q.category));
  if (q.brand) conditions.push(eq(products.brand, q.brand));
  if (q.gender) conditions.push(eq(products.gender, q.gender));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(desc(products.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);

  return { rows, total: countRows[0]?.count ?? 0 };
}

export async function getProduct(id: number): Promise<ProductRow> {
  await ensureDb();
  const row = (await db.select().from(products).where(eq(products.id, id)))[0];
  if (!row) throw new PublicError("Product not found", 404);
  return row;
}
