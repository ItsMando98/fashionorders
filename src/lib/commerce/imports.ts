import {
  runCatalogAudit,
  runMediaWarm,
  queueNewProductAudit,
} from "./catalog-agent";
import {
  uniqueProductImages,
  isYupooList,
  extractProcurementLinks,
  procurementUrl,
  variantHints,
} from "../server/sourcing";
import { collectAlbumPageUrls } from "../server/seller-scraper";
import { categorizeProductImage, geminiEnabled } from "../server/categorize";
import * as cheerio from "cheerio";
import crypto from "node:crypto";
import type { User } from "../types";
import { PublicError } from "../server/http";
import { isAllowedShopHost } from "../server/hosts";
import {
  fetchAllowed,
  readLimited,
  extractPriceFromText,
  detectBrandAndCategory,
} from "../server/scraper";
import { database, transaction, type Row } from "./core";
import { categoryFromLegacy } from "./taxonomy";
import { uploadSourceImage } from "./storage";
export function canonicalUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PublicError("Ungültiger Produktlink.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !isAllowedShopHost(url.hostname)
  )
    throw new PublicError(
      "Nur HTTPS-Links von Yupoo und Weidian sind erlaubt.",
    );
  url.hash = "";
  if (url.hostname.endsWith("yupoo.com")) {
    if (!/^\/albums\/\d+\/?$/.test(url.pathname))
      throw new PublicError("Bitte einen Produktalbum-Link verwenden.");
    url.search = "";
  } else {
    const id = url.searchParams.get("itemID") || url.searchParams.get("id");
    if (!id || !/^\d+$/.test(id))
      throw new PublicError("Weidian-Artikel-ID fehlt.");
    url = new URL(`https://weidian.com/item.html?itemID=${id}`);
  }
  return url.toString().replace(/\/$/, "");
}
export function canonicalImportUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (
      isYupooList(url) &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port
    ) {
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    }
  } catch {}
  return canonicalUrl(raw);
}
export async function queueImports(user: User, urls: unknown) {
  if (!Array.isArray(urls) || !urls.length)
    throw new PublicError("Mindestens einen Link angeben.");
  const clean = [...new Set(urls.map((u) => canonicalImportUrl(String(u))))];
  return transaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${user.id},71623)`;
    const jobs = [];
    for (const url of clean) {
      const [existing] =
        await tx`SELECT id FROM shop_jobs WHERE user_id=${user.id} AND kind='import' AND payload->>'url'=${url} AND coalesce(payload->>'catalog','false')='false' AND status IN ('queued','running')`;
      if (existing) {
        jobs.push(existing.id);
        continue;
      }
      const [job] =
        await tx`INSERT INTO shop_jobs(user_id,kind,payload) VALUES(${user.id},'import',${tx.json({ url })}) RETURNING id`;
      jobs.push(job.id);
    }
    return jobs;
  });
}
export async function importJobs(user: User) {
  return database()`SELECT id,status,attempts,payload->>'url' AS url,result,error,created_at FROM shop_jobs WHERE user_id=${user.id} AND kind='import' ORDER BY id DESC`;
}
export type StructuredProduct = {
  url: string;
  title: string;
  brand: string;
  category: string;
  description: string;
  images: string[];
  variant_hints: { sizes: string[]; colors: string[] };
  price_cny: number | null;
  warnings: string[];
  procurement_links?: string[];
};
export function cleanCustomerText(value: string) {
  return value
    .split(/\n/)
    .filter(
      (line) => !/whatsapp|wechat|telegram|how to order|payment/i.test(line),
    )
    .join("\n")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(?:price|售价|价格)\s*[:：]?\s*[¥￥]?\s*\d+(?:\.\d+)?/gi, "")
    .replace(/[¥￥💰]\s*\d+(?:\.\d+)?/g, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:CNY|RMB|yuan|元)\b/gi, "")
    .trim();
}
export function parseAlbum(html: string, url: string): StructuredProduct {
  const $ = cheerio.load(html);
  const title =
    $(".showalbumheader__gallerytitle").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim();
  if (
    !title ||
    /captcha|access denied|just a moment|verify.*human/i.test(title)
  )
    throw new Error("Quelle blockiert oder Produkt nicht erkannt.");
  const description = $(".showalbumheader__gallerysubtitle").text().trim();
  const images: string[] = [];
  $(
    '[data-origin-src],[data-original],[data-src],meta[property="og:image"]',
  ).each((_, el) => {
    const raw =
      $(el).attr("data-origin-src") ||
      $(el).attr("data-original") ||
      $(el).attr("data-src") ||
      $(el).attr("content");
    if (!raw) return;
    try {
      const image = new URL(raw, url);
      if (image.hostname === "photo.yupoo.com" && image.protocol === "https:")
        images.push(image.toString());
    } catch {}
  });
  const detected = detectBrandAndCategory(title, description, url);
  return {
    url,
    title: cleanCustomerText(title).slice(0, 300) || "Produkt zur Prüfung",
    brand: detected.brand,
    category: detected.category,
    description: cleanCustomerText(description).slice(0, 10000),
    images: uniqueProductImages(images),
    variant_hints: variantHints(description),
    procurement_links: extractProcurementLinks(html, url),
    price_cny: extractPriceFromText(title) || extractPriceFromText(description),
    warnings: ["Varianten und Produktzuordnung müssen geprüft werden."],
  };
}
export async function scrapeStructured(
  rawUrl: string,
): Promise<StructuredProduct> {
  const url = canonicalUrl(rawUrl);
  let sidecar: Row | null = null;
  let direct: StructuredProduct | null = null;
  const sidecarUrl = process.env.SCRAPER_SIDECAR_URL;
  if (sidecarUrl && process.env.SCRAPER_SIDECAR_DISABLED !== "1") {
    try {
      const res = await fetch(`${sidecarUrl.replace(/\/$/, "")}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scraper-Token": process.env.SCRAPER_TOKEN || "",
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(65000),
      });
      if (res.ok) sidecar = await res.json();
    } catch {}
  }
  // Parse the complete album rather than returning only its cover.
  if (new URL(url).hostname.endsWith("yupoo.com")) {
    const response = await fetchAllowed(
      `${url}?uid=1`,
      { "User-Agent": "Mozilla/5.0", Referer: url },
      "shop",
    );
    if (response?.ok) {
      const html = await readLimited(response, 1_500_000);
      if (html) {
        try {
          direct = parseAlbum(html.toString("utf8"), url);
        } catch {}
      }
    }
  }
  if (sidecar?.title) {
    const images = Array.isArray(sidecar.images)
      ? sidecar.images
      : [sidecar.img_url];
    const sizes = Array.isArray(sidecar.variant_hints?.sizes)
      ? sidecar.variant_hints.sizes
      : [];
    const links = [
      ...new Set([
        ...(direct?.procurement_links || []),
        ...(Array.isArray(sidecar.procurement_links)
          ? sidecar.procurement_links
          : [sidecar.weidian_url]
        )
          .map((v: unknown) =>
            typeof v === "string" ? procurementUrl(v) : null,
          )
          .filter((v: string | null): v is string => !!v),
      ]),
    ];
    const d = detectBrandAndCategory(sidecar.title, "", url);
    return {
      url,
      title: cleanCustomerText(String(sidecar.title)).slice(0, 300),
      brand: d.brand,
      category: d.category,
      description: cleanCustomerText(
        String(sidecar.description || direct?.description || ""),
      ).slice(0, 10000),
      images: uniqueProductImages([
        ...images.filter((s: unknown): s is string => typeof s === "string"),
        ...(direct?.images || []),
      ]),
      procurement_links: links,
      variant_hints: {
        sizes: sizes.length ? sizes : direct?.variant_hints.sizes || [],
        colors:
          sidecar.variant_hints?.colors || direct?.variant_hints.colors || [],
      },
      price_cny:
        typeof sidecar.price_cny === "number" && sidecar.price_cny > 0
          ? sidecar.price_cny
          : (direct?.price_cny ?? null),
      warnings: ["Lieferbarkeit und Varianten ungeprüft."],
    };
  }
  if (direct) return direct;
  throw new PublicError(
    "Quelle nicht erreichbar oder Produktdaten nicht erkannt.",
    422,
  );
}
export async function runImport(
  job: Row,
  token: string,
  scraper = scrapeStructured,
  uploader = uploadSourceImage,
) {
  const data = await scraper(job.payload.url);
  // Wizard = KI-Listing-Assistent im Admin: legt einen Entwurf an. Titel, Varianten und Kategorie
  // werden dort vom Admin bestätigt, deshalb hier keine Automatik (kein Auto-Titel, keine Sortier-Prüfung).
  const wizard = job.payload.wizard === true;
  const manualLink = wizard
    ? procurementUrl(String(job.payload.procurement_url || ""))
    : null;
  if (manualLink)
    data.procurement_links = [
      ...new Set([manualLink, ...(data.procurement_links || [])]),
    ];
  const ai =
    job.payload.catalog && !wizard && geminiEnabled() && data.images[0]
      ? await categorizeProductImage(data.images[0], data.url)
      : null;
  if (ai) {
    data.title = ai.title || data.title;
    data.brand = ai.brand || data.brand;
    data.category = ai.subcategory || ai.category || data.category;
  }
  const visibility = job.payload.catalog ? "catalog" : "private";
  const bucket = job.payload.catalog
    ? process.env.STORAGE_CATALOG_BUCKET || "fashion-catalog"
    : process.env.STORAGE_PRIVATE_BUCKET || "fashion-private";
  const media: { path: string; position: number }[] = [];
  const failures: string[] = [];
  for (const [index, url] of data.images.entries()) {
    try {
      media.push({
        path: await uploader(
          url,
          data.url,
          bucket,
          `imports/${job.payload.catalog ? "catalog" : job.user_id}/${crypto.createHash("sha256").update(data.url).digest("hex")}`,
        ),
        position: index,
      });
    } catch (e) {
      // Never swallow silently: without this the admin only sees "41 of 41 failed".
      failures.push(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
  }
  if (failures.length)
    console.warn(
      "commerce-worker import images",
      job.id,
      `${failures.length}/${data.images.length} failed, first:`,
      failures[0],
    );
  return transaction(async (tx) => {
    const [live] =
      await tx`SELECT id FROM shop_jobs WHERE id=${job.id} AND token=${token} AND status='running' AND lease_until>now() FOR UPDATE`;
    if (!live) throw new Error("Job-Lease abgelaufen.");
    const [existing] =
      await tx`SELECT * FROM products WHERE ((visibility='catalog' AND ${visibility === "catalog"}) OR (owner_user_id=${job.user_id} AND visibility='private' AND ${visibility === "private"})) AND source_url=${data.url} FOR UPDATE`;
    let p = existing;
    if (!p) {
      [p] =
        await tx`INSERT INTO products(title,brand,category,description,source_url,seller,source_platform,visibility,owner_user_id,publication,active,listing_origin,price_cny) VALUES(${data.title},${data.brand},${data.category},${data.description},${data.url},${new URL(data.url).hostname},${new URL(data.url).hostname.endsWith("yupoo.com") ? "Yupoo" : "Weidian"},${visibility},${visibility === "private" ? job.user_id : null},${wizard ? "draft" : "review"},1,${wizard ? "wizard" : ""},${wizard ? data.price_cny : null}) RETURNING *`;
    }
    const links = data.procurement_links || [];
    if (!p.manual_fields?.includes("procurement_url") || manualLink)
      await tx`UPDATE products SET procurement_url=${manualLink || (links.length === 1 ? links[0] : "")},procurement_links=${tx.json(links)} WHERE id=${p.id}`;
    if (ai && !existing)
      await tx`UPDATE products SET gender=${ai.gender} WHERE id=${p.id}`;
    const c = categoryFromLegacy(data.category);
    if (c && !existing)
      await tx`INSERT INTO shop_product_categories(product_id,category_id) VALUES(${p.id},${c}) ON CONFLICT DO NOTHING`;
    // Hints are deliberately not treated as verified stock or confirmed variants.
    // Im Wizard legt der Admin Farben und Größen selbst fest; dort entstehen die Varianten erst beim Speichern.
    const sizes = data.variant_hints.sizes.length
      ? data.variant_hints.sizes
      : ["Noch festzulegen"];
    if (!wizard)
      for (const size of sizes)
        await tx`INSERT INTO shop_variants(product_id,size,color,purchase_fen) VALUES(${p.id},${String(size).slice(0, 60)},'',${data.price_cny === null ? null : Math.round(data.price_cny * 100)}) ON CONFLICT(product_id,size,color) DO NOTHING`;
    for (const m of media)
      await tx`INSERT INTO shop_media(product_id,object_path,bucket,alt,position) VALUES(${p.id},${m.path},${bucket},${data.title},${m.position}) ON CONFLICT DO NOTHING`;
    if (visibility === "catalog" && !wizard)
      await queueNewProductAudit(tx, job.user_id, p.id);
    await tx`INSERT INTO shop_saved(user_id,product_id) VALUES(${job.user_id},${p.id}) ON CONFLICT DO NOTHING`;
    const result = {
      product_id: p.id,
      // Nur für den Assistenten: war das Produkt schon vorhanden (dann überschreibt er Inhalte)?
      already_existed: !!existing,
      publication: p.publication,
      images: media.length,
      source_images: data.images.length,
      warnings: [
        ...data.warnings,
        ...(!links.length
          ? [
              "Kein Taobao-/Weidian-Bestelllink gefunden; Admin-Prüfung erforderlich.",
            ]
          : links.length > 1
            ? [
                "Mehrere Bestelllinks gefunden; Admin muss den passenden auswählen.",
              ]
            : []),
        ...(media.length < data.images.length
          ? [
              `${data.images.length - media.length} von ${data.images.length} Bildern konnten nicht gespeichert werden (${failures[0] || "unbekannter Grund"}); Galerie bitte prüfen.`,
            ]
          : []),
      ],
    };
    await tx`UPDATE shop_jobs SET status='done',error='',result=${tx.json(result)},lease_until=NULL,updated_at=now() WHERE id=${job.id} AND token=${token}`;
    return result;
  });
}
export async function expandCollection(
  job: Row,
  token: string,
  collect: (
    url: string,
    page: number,
  ) => Promise<
    string[] | { urls: string[]; identities: string[] }
  > = collectAlbumPageUrls,
) {
  const url = job.payload.url || job.payload.seller_url;
  const page = Number(job.payload.page || 1);
  const root = Number(job.payload.root_job_id || job.id);
  const discovered = await collect(url, page);
  const urls = Array.isArray(discovered) ? discovered : discovered.urls;
  const identities = Array.isArray(discovered)
    ? discovered
    : discovered.identities;
  return transaction(async (tx) => {
    const [live] =
      await tx`SELECT id FROM shop_jobs WHERE id=${job.id} AND token=${token} AND status='running' AND lease_until>now() FOR UPDATE`;
    if (!live) throw new Error("Job-Lease abgelaufen.");
    await tx`SELECT pg_advisory_xact_lock(${job.user_id},71623)`;
    const fresh: string[] = [];
    let newIdentities = 0;
    const products = new Set(urls.map(canonicalUrl));
    for (const raw of identities) {
      const album = canonicalUrl(raw);
      const inserted =
        await tx`INSERT INTO shop_import_albums(root_job_id,album_url,is_product) VALUES(${root},${album},${products.has(album)}) ON CONFLICT DO NOTHING RETURNING album_url`;
      if (inserted.length) {
        newIdentities++;
        if (products.has(album)) fresh.push(album);
      }
    }
    // Repeated/empty pages finish the traversal. No product or page quota.
    let continuation: number | null = null;
    if (newIdentities) {
      const [next] =
        await tx`INSERT INTO shop_jobs(user_id,kind,payload) VALUES(${job.user_id},${job.kind},${tx.json({ ...job.payload, page: page + 1, root_job_id: root })}) RETURNING id`;
      continuation = next.id;
    }
    const children = [];
    for (const album of fresh) {
      const catalog = job.kind === "source" || !!job.payload.catalog;
      const [existing] =
        await tx`SELECT id FROM shop_jobs WHERE user_id=${job.user_id} AND kind='import' AND payload->>'url'=${album} AND coalesce(payload->>'catalog','false')=${String(catalog)} AND status IN ('queued','running')`;
      if (existing) {
        children.push(existing.id);
        continue;
      }
      const [child] =
        await tx`INSERT INTO shop_jobs(user_id,kind,payload) VALUES(${job.user_id},'import',${tx.json({ url: album, collection_url: url, root_job_id: root, catalog })}) RETURNING id`;
      children.push(child.id);
    }
    const [total] =
      await tx`SELECT count(*)::int AS n FROM shop_import_albums WHERE root_job_id=${root} AND is_product`;
    const result = {
      type: "collection",
      page,
      jobs: children,
      albums: total.n,
      complete: !continuation,
      continuation,
      warnings: [],
    };
    await tx`UPDATE shop_jobs SET status='done',error='',result=${tx.json(result)},lease_until=NULL,updated_at=now() WHERE id=${job.id} AND token=${token}`;
    if (root !== job.id)
      await tx`UPDATE shop_jobs SET result=${tx.json(result)},updated_at=now() WHERE id=${root}`;
    if (job.payload.source_id)
      await tx`UPDATE scrape_sources SET last_status=${continuation ? "running" : "ok"},last_message=${`${total.n} Alben eingereiht${continuation ? "; weitere Seiten werden gelesen" : "; vollständig gelesen"}`} WHERE id=${job.payload.source_id}`;
    return result;
  });
}
export async function claimJob(): Promise<Row | null> {
  return transaction(async (tx) => {
    await tx`UPDATE shop_jobs SET status='failed',error='Maximale Wiederholungen nach Prozessabbruch erreicht.',lease_until=NULL WHERE status='running' AND lease_until<now() AND attempts>=5`;
    const token = crypto.randomUUID();
    const [job] =
      await tx`UPDATE shop_jobs SET status='running',attempts=attempts+1,token=${token},lease_until=now()+interval '3 minutes',updated_at=now() WHERE id=(SELECT id FROM shop_jobs WHERE (status='queued' AND available_at<=now() OR status='running' AND lease_until<now()) AND attempts<5 ORDER BY CASE WHEN payload ? 'page' THEN 0 ELSE 1 END,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`;
    return job ? { ...job, token } : null;
  });
}
export async function queueSources() {
  await transaction(async (tx) => {
    const [admin] =
      await tx`SELECT id FROM users WHERE role='admin' AND disabled=0 ORDER BY id LIMIT 1`;
    if (!admin) return;
    const sources =
      await tx`SELECT * FROM scrape_sources WHERE active=1 AND (last_run_at IS NULL OR (last_run_at::timestamp AT TIME ZONE 'UTC')+interval '1 hour'*interval_hours<now()) FOR UPDATE SKIP LOCKED`;
    for (const source of sources) {
      const [pending] =
        await tx`SELECT id FROM shop_jobs WHERE kind='source' AND payload->>'source_id'=${String(source.id)} AND status IN ('queued','running')`;
      if (pending) continue;
      await tx`INSERT INTO shop_jobs(user_id,kind,payload) VALUES(${admin.id},'source',${tx.json({ source_id: source.id, seller_url: source.seller_url })})`;
      await tx`UPDATE scrape_sources SET last_run_at=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),last_status='queued' WHERE id=${source.id}`;
    }
  });
}
export async function workOnce() {
  const job = await claimJob();
  if (!job) return false;
  const token = job.token;
  const heartbeat = setInterval(() => {
    void database()`UPDATE shop_jobs SET lease_until=now()+interval '3 minutes' WHERE id=${job.id} AND token=${token} AND status='running' AND lease_until>now()`.catch(
      () => {},
    );
  }, 30000);
  try {
    if (job.kind === "import" && isYupooList(new URL(job.payload.url)))
      await expandCollection(job, token);
    else if (job.kind === "import") await runImport(job, token);
    else if (job.kind === "catalog_audit") await runCatalogAudit(job, token);
    else if (job.kind === "media_warm") await runMediaWarm(job, token);
    else if (job.kind === "source") await expandCollection(job, token);
    else if (job.kind === "notify") {
      await database()`UPDATE shop_jobs SET status='done',result='{"channel":"in_app"}',lease_until=NULL WHERE id=${job.id} AND token=${token}`;
    } else {
      throw new Error("Unbekannte Jobart.");
    }
  } catch (e) {
    console.error(
      "commerce-worker",
      job.id,
      e instanceof Error ? e.message : "Unknown worker failure",
    );
    await database()`UPDATE shop_jobs SET status=${job.attempts >= 5 ? "failed" : "queued"},error=${e instanceof PublicError ? e.message : "Import fehlgeschlagen. Bitte Quelle und Medienkonfiguration prüfen."},available_at=now()+(${Math.min(3600, 2 ** job.attempts * 15)} * interval '1 second'),lease_until=NULL,updated_at=now() WHERE id=${job.id} AND token=${token}`;
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
