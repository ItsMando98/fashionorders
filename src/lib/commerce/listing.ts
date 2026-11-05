/**
 * Listing-Assistent (BACKEND).
 *
 * Ablauf, den das Frontend (/admin/listing) Schritt für Schritt benutzt:
 *
 *   POST admin/listing/start            Yupoo-Link (+ optional Taobao-Link) -> Import-Job
 *   GET  admin/listing/jobs/:jobId      Job-Status (der Worker lädt Bilder & Daten)
 *   POST admin/listing/:id/analyze      KI schlägt Farben, Größen, Merkmale vor
 *   POST admin/listing/:id/generate     KI schreibt Titel, Beschreibung, Highlights, FAQ ...
 *   POST admin/listing/:id/model-shot   KI erzeugt ein Model-Foto
 *   POST admin/listing/:id/apply        alles speichern (Varianten, Texte, Status)
 *
 * Das Produkt wird gleich nach dem Import als ENTWURF angelegt. So gehen Fortschritt und
 * Bilder bei einem Neuladen der Seite nicht verloren, und Kunden sehen nichts Unfertiges.
 */
import { database, transaction, requireAdmin, type Row } from "./core";
import { accessible, productDTO } from "./catalog";
import { canonicalUrl } from "./imports";
import { procurementUrl, variantHints } from "../server/sourcing";
import { cachedMedia } from "./media-cache";
import { uploadImageBytes } from "./storage";
import { integer } from "./money";
import { categories } from "./taxonomy";
import { PublicError } from "../server/http";
import { rateLimit } from "../server/rate-limit";
import type { User } from "../types";
import {
  analyzeProduct,
  writeListing,
  generateModelImage,
  requireListingAi,
  listingAiStatus,
  sanitizeCopy,
  cleanColours,
  cleanList,
  cleanText,
  cleanBlock,
  aspectRatio,
  GENDERS,
  type ListingCopy,
  type Colour,
} from "./listing-ai";

// ---------------------------------------------------------------- Hilfsfunktionen

function aiLimit(user: User, bucket: string, max: number) {
  const r = rateLimit(`listing:${bucket}:${user.id}`, max, 3_600_000);
  if (!r.ok)
    throw new PublicError(
      `Zu viele KI-Anfragen. Bitte in ${Math.ceil(r.retryAfterSec / 60)} Minute(n) erneut versuchen.`,
      429,
    );
}

function wizardProduct(p: Row) {
  if (p.visibility !== "catalog")
    throw new PublicError(
      "Der Assistent bearbeitet Shop-Produkte, keine privaten Importe.",
    );
}

/** Lädt Produktfotos für die KI (verkleinert, ohne Größentabellen und ohne bereits erzeugte KI-Fotos). */
async function productImages(
  tx: ReturnType<typeof database>,
  productId: number,
  options: { ids?: number[]; limit: number; width: 640 | 1600 },
) {
  const rows = options.ids
    ? await tx`SELECT id,bucket,object_path FROM shop_media WHERE product_id=${productId} AND id=ANY(${options.ids}::int[]) AND kind<>'size_chart' ORDER BY position,id LIMIT ${options.limit}`
    : await tx`SELECT id,bucket,object_path FROM shop_media WHERE product_id=${productId} AND kind NOT IN ('size_chart','ai_model') ORDER BY position,id LIMIT ${options.limit}`;
  const images: Buffer[] = [];
  for (const m of rows) images.push(await cachedMedia(m, options.width));
  return images;
}

const categoryLabel = (id: string) =>
  categories.find((c) => c[0] === id)?.[2] || "";

// ---------------------------------------------------------------- Schritt 1: Import starten

export async function startListingImport(user: User, body: Row) {
  requireAdmin(user);
  const url = canonicalUrl(String(body.url || ""));
  const rawLink = String(body.procurement_url || "").trim();
  const link = rawLink ? procurementUrl(rawLink) : null;
  if (rawLink && !link)
    throw new PublicError(
      "Der Bestelllink muss ein konkreter Taobao- oder Weidian-Artikel sein (z. B. https://item.taobao.com/item.htm?id=123).",
    );
  return transaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${user.id},71624)`;
    const [existing] =
      await tx`SELECT id FROM shop_jobs WHERE user_id=${user.id} AND kind='import' AND payload->>'url'=${url} AND payload->>'wizard'='true' AND status IN ('queued','running')`;
    if (existing) return existing.id as number;
    const [job] =
      await tx`INSERT INTO shop_jobs(user_id,kind,payload) VALUES(${user.id},'import',${tx.json({ url, catalog: true, wizard: true, ...(link ? { procurement_url: link } : {}) })}) RETURNING id`;
    return job.id as number;
  });
}

export async function listingJobStatus(user: User, jobId: number) {
  requireAdmin(user);
  const [job] =
    await database()`SELECT id,status,attempts,error,result FROM shop_jobs WHERE id=${jobId} AND user_id=${user.id} AND kind='import' AND payload->>'wizard'='true'`;
  if (!job) throw new PublicError("Import nicht gefunden.", 404);
  return job;
}

// ---------------------------------------------------------------- Schritt 3: KI-Vorschläge

export async function analyzeListing(user: User, id: number) {
  requireAdmin(user);
  requireListingAi();
  aiLimit(user, "text", 60);
  const tx = database();
  const p = await accessible(tx, user, id);
  wizardProduct(p);
  const images = await productImages(tx, id, { limit: 8, width: 640 });
  if (!images.length)
    throw new PublicError("Das Produkt hat noch keine Bilder.", 409);
  const hints = variantHints(p.description || "");
  return {
    analysis: await analyzeProduct({
      title: p.title,
      description: p.description || "",
      hintSizes: hints.sizes,
      hintColors: hints.colors,
      images,
    }),
  };
}

// ---------------------------------------------------------------- Schritt 4: Texte schreiben

export async function generateListingCopy(user: User, id: number, body: Row) {
  requireAdmin(user);
  requireListingAi();
  aiLimit(user, "text", 60);
  const tx = database();
  const p = await accessible(tx, user, id);
  wizardProduct(p);
  const images = await productImages(tx, id, { limit: 4, width: 640 });
  const gender = String(body.gender || "");
  const categoryId = String(body.category_id || "");
  const copy = await writeListing({
    productType: cleanText(body.product_type, 80),
    category: categoryLabel(categoryId),
    gender: (GENDERS as readonly string[]).includes(gender) ? gender : "",
    colors: cleanColours(body.colors).map((c) => c.name),
    sizes: cleanList(body.sizes, 40, 20),
    features: cleanList(body.features, 12, 60),
    material: cleanText(body.material, 120),
    fit: cleanText(body.fit, 120),
    brand: cleanText(body.brand, 80),
    notes: cleanBlock(body.notes, 1000),
    sourceTitle: p.title,
    sourceDescription: p.description || "",
    images,
  });
  return { copy };
}

// ---------------------------------------------------------------- Schritt 6: Speichern

export type ApplyInput = {
  copy: ListingCopy;
  brand: string;
  gender: string;
  category_id: string;
  colors: Colour[];
  sizes: string[];
  purchase_fen: number | null;
  availability: "review" | "available";
  price_approved: boolean;
  procurement_url: string;
  publication: "draft" | "review" | "published";
};

/** Prüft alles, was vom Browser kommt. Reine Funktion, deshalb gut testbar. */
export function sanitizeApply(b: Row): ApplyInput {
  const copy = sanitizeCopy(b.copy);
  if (!copy.title) throw new PublicError("Titel erforderlich.");
  const gender = String(b.gender ?? "");
  if (!(GENDERS as readonly string[]).includes(gender))
    throw new PublicError("Ungültige Zielgruppe.");
  const category_id = String(b.category_id ?? "");
  if (category_id && !categories.some((c) => c[0] === category_id))
    throw new PublicError("Ungültige Kategorie.");
  const colors = cleanColours(b.colors);
  const sizes = cleanList(b.sizes, 40, 20);
  if (colors.length * Math.max(sizes.length, 1) > 200)
    throw new PublicError("Maximal 200 Varianten (Farben × Größen).");
  let purchase_fen: number | null = null;
  if (b.purchase_cny !== null && b.purchase_cny !== undefined && b.purchase_cny !== "") {
    const cny = Number(b.purchase_cny);
    if (!Number.isFinite(cny) || cny <= 0 || cny > 1_000_000)
      throw new PublicError("Ungültiger Einkaufspreis.");
    purchase_fen = Math.round(cny * 100);
  }
  const availability = b.availability === "available" ? "available" : "review";
  if (!["draft", "review", "published"].includes(String(b.publication)))
    throw new PublicError("Ungültiger Veröffentlichungsstatus.");
  const rawLink = String(b.procurement_url ?? "").trim();
  const link = rawLink ? procurementUrl(rawLink) : "";
  if (rawLink && !link)
    throw new PublicError(
      "Bestelllink muss ein konkreter Taobao- oder Weidian-Artikel sein.",
    );
  return {
    copy,
    brand: cleanText(b.brand, 120),
    gender,
    category_id,
    colors,
    sizes,
    purchase_fen,
    availability,
    price_approved: purchase_fen !== null && b.price_approved !== false,
    procurement_url: link || "",
    publication: b.publication as ApplyInput["publication"],
  };
}

export async function applyListing(user: User, id: number, body: Row) {
  requireAdmin(user);
  const input = sanitizeApply(body);
  const warnings: string[] = [];
  const product = await transaction(async (tx) => {
    const [p] = await tx`SELECT * FROM products WHERE id=${id} FOR UPDATE`;
    if (!p) throw new PublicError("Produkt nicht gefunden.", 404);
    wizardProduct(p);
    const c = input.copy;
    const listing = {
      tagline: c.tagline,
      highlights: c.highlights,
      care: c.care,
      size_guide: c.size_guide,
      faq: c.faq,
      tags: c.tags,
      seo_title: c.seo_title,
      seo_description: c.seo_description,
      colors: input.colors,
      generated_at: new Date().toISOString(),
    };
    const links = [
      ...new Set([
        ...(input.procurement_url ? [input.procurement_url] : []),
        ...(Array.isArray(p.procurement_links) ? p.procurement_links : []),
      ]),
    ];
    await tx`UPDATE products SET title=${c.title},brand=${input.brand},description=${c.description},material=${c.material},fit=${c.fit},gender=${input.gender},procurement_url=${input.procurement_url},procurement_links=${tx.json(links)},listing=${tx.json(listing)},listing_origin='wizard',publication=${input.publication},active=1,price_cny=${input.purchase_fen === null ? null : input.purchase_fen / 100},manual_fields='["title","brand","description","category","gender","procurement_url"]'::jsonb WHERE id=${id}`;

    if (input.category_id) {
      await tx`DELETE FROM shop_product_categories WHERE product_id=${id}`;
      await tx`INSERT INTO shop_product_categories(product_id,category_id) VALUES(${id},${input.category_id}) ON CONFLICT DO NOTHING`;
    }

    // Varianten = jede Farbe × jede Größe. Keine Farbe / keine Größe = leere Variante ("Einheitsgröße").
    const colorNames = input.colors.length ? input.colors.map((x) => x.name) : [""];
    const sizeNames = input.sizes.length ? input.sizes : [""];
    const wanted = new Set<string>();
    for (const color of colorNames)
      for (const size of sizeNames) {
        wanted.add(`${size}\u0000${color}`);
        await tx`INSERT INTO shop_variants(product_id,size,color,availability,purchase_fen,price_approved) VALUES(${id},${size},${color},${input.availability},${input.purchase_fen},${input.price_approved}) ON CONFLICT(product_id,size,color) DO UPDATE SET availability=excluded.availability,purchase_fen=excluded.purchase_fen,price_approved=excluded.price_approved`;
      }
    // Alte Varianten, die nicht mehr gewünscht sind: löschen, außer sie hängen an Warenkorb/Bestellung.
    const existing =
      await tx`SELECT id,size,color FROM shop_variants WHERE product_id=${id}`;
    for (const v of existing) {
      if (wanted.has(`${v.size}\u0000${v.color}`)) continue;
      const [used] =
        await tx`SELECT (EXISTS(SELECT 1 FROM shop_cart WHERE variant_id=${v.id}) OR EXISTS(SELECT 1 FROM shop_order_items WHERE variant_id=${v.id})) AS used`;
      if (used.used)
        await tx`UPDATE shop_variants SET availability='unavailable' WHERE id=${v.id}`;
      else {
        await tx`UPDATE shop_media SET variant_id=NULL WHERE variant_id=${v.id}`;
        await tx`DELETE FROM shop_variants WHERE id=${v.id}`;
      }
    }

    const [photo] =
      await tx`SELECT count(*)::int AS n FROM shop_media WHERE product_id=${id} AND kind NOT IN ('size_chart')`;
    if (input.publication === "published") {
      if (!photo.n)
        throw new PublicError(
          "Vor der Veröffentlichung mindestens ein Produktbild behalten.",
        );
      if (input.purchase_fen === null)
        throw new PublicError(
          "Zum Veröffentlichen bitte einen Einkaufspreis (CNY) eintragen.",
        );
    }
    if (!input.procurement_url)
      warnings.push(
        "Es ist kein Bestelllink (Taobao/Weidian) hinterlegt. Ohne ihn fehlt dir der Link in Lieferantenaufträgen.",
      );
    if (input.availability === "review")
      warnings.push(
        "Verfügbarkeit steht auf „Prüfen“. Kunden können bestellen, du bestätigst Größe und Lagerbestand im Angebot.",
      );
    return productDTO(
      tx,
      user,
      (await tx`SELECT * FROM products WHERE id=${id}`)[0],
    );
  });
  return { product, warnings };
}

// ---------------------------------------------------------------- Schritt 5: Model-Fotos

export async function createModelShot(user: User, id: number, body: Row) {
  requireAdmin(user);
  requireListingAi();
  aiLimit(user, "image", 60);
  const prompt = String(body.prompt ?? "").trim();
  if (prompt.length < 20 || prompt.length > 4000)
    throw new PublicError("Der Prompt muss zwischen 20 und 4000 Zeichen lang sein.");
  const ids: number[] = [
    ...new Set<number>(
      (Array.isArray(body.reference_media_ids) ? body.reference_media_ids : [])
        .slice(0, 3)
        .map((v: unknown) => integer(v)),
    ),
  ];
  if (!ids.length)
    throw new PublicError("Bitte mindestens ein Referenzfoto des Kleidungsstücks wählen.");
  const tx = database();
  const p = await accessible(tx, user, id);
  wizardProduct(p);
  const references = await productImages(tx, id, { ids, limit: 3, width: 1600 });
  if (references.length !== ids.length)
    throw new PublicError("Ein Referenzfoto gehört nicht zu diesem Produkt.");
  const bytes = await generateModelImage({
    prompt,
    references,
    aspect: aspectRatio(body.aspect_ratio),
  });
  const bucket = process.env.STORAGE_CATALOG_BUCKET || "fashion-catalog";
  const objectPath = await uploadImageBytes(bytes, bucket, `products/${id}/ai`);
  const inserted = await transaction(
    (sql) =>
      sql`INSERT INTO shop_media(product_id,object_path,bucket,alt,position,kind) VALUES(${id},${objectPath},${bucket},${cleanText(`${p.title} – Model-Foto`, 300)},(SELECT coalesce(max(position),-1)+1 FROM shop_media WHERE product_id=${id}),'ai_model') ON CONFLICT DO NOTHING RETURNING id,alt,position,kind`,
  );
  const media: Row | undefined = inserted[0];
  if (!media)
    throw new PublicError("Dieses Bild wurde bereits gespeichert.", 409);
  return {
    media: { ...media, url: `/api/commerce/media/${media.id}` } as Row,
  };
}

export async function deleteProductMedia(
  user: User,
  id: number,
  mediaId: number,
) {
  requireAdmin(user);
  const r =
    await database()`DELETE FROM shop_media WHERE id=${mediaId} AND product_id=${id} RETURNING id`;
  if (!r.length) throw new PublicError("Bild nicht gefunden.", 404);
  return { ok: true };
}

// ---------------------------------------------------------------- Routing

export async function listingRoute(
  user: User,
  method: string,
  path: string[],
  body: Row,
): Promise<{ data: unknown; status?: number }> {
  requireAdmin(user);
  const [first, second] = path;
  if (method === "GET" && first === "config")
    return { data: listingAiStatus() };
  if (method === "POST" && first === "start")
    return {
      data: { job_id: await startListingImport(user, body) },
      status: 202,
    };
  if (method === "GET" && first === "jobs" && second)
    return { data: await listingJobStatus(user, integer(second)) };
  const id = first && /^\d+$/.test(first) ? integer(first) : null;
  if (id && method === "POST" && second === "analyze")
    return { data: await analyzeListing(user, id) };
  if (id && method === "POST" && second === "generate")
    return { data: await generateListingCopy(user, id, body) };
  if (id && method === "POST" && second === "model-shot")
    return { data: await createModelShot(user, id, body), status: 201 };
  if (id && method === "POST" && second === "apply")
    return { data: await applyListing(user, id, body) };
  throw new PublicError("Route nicht gefunden.", 404);
}
