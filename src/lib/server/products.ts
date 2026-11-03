import { desc, eq, and, ilike, or, sql } from "drizzle-orm";
import { db, ensureDb, products } from "./db";
import type { ProductRow } from "./schema";
import { scrapeAnyUrl } from "./scraper";
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
    active: 1,
    updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  };

  // Dedupe: gleiche Quell-URL -> Update statt Duplikat
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

  const inserted = (await db.insert(products).values(values).returning())[0];
  return inserted;
}

export interface ProductListQuery {
  search?: string;
  category?: string;
  brand?: string;
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
