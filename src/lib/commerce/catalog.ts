import { procurementUrl } from "../server/sourcing";
import type { Sql } from "postgres";
import {
  database,
  type Row,
  requireAdmin,
  transaction,
  settings,
} from "./core";
import type { User } from "../types";
import { isAllowedShopHost } from "../server/hosts";
import { PublicError } from "../server/http";
import { cents, integer, saleCents, customerFen } from "./money";
import { categories } from "./taxonomy";
export async function accessible(tx: Sql, user: User, id: number) {
  const [p] =
    await tx`SELECT * FROM products WHERE id=${id} AND ((${user.role === "admin"}) OR (active=1 AND ((visibility='catalog' AND publication='published') OR owner_user_id=${user.id} OR EXISTS(SELECT 1 FROM shop_collection_items ci JOIN shop_collection_shares cs ON cs.collection_id=ci.collection_id WHERE ci.product_id=products.id AND cs.user_id=${user.id}))))`;
  if (!p) throw new PublicError("Produkt nicht gefunden.", 404);
  return p;
}
export async function productDTO(
  tx: Sql,
  user: User,
  p: Row,
  s?: Record<string, string>,
  bundle?: { variants: Row[]; media: Row[]; cats: Row[]; saved: boolean },
) {
  s = s || (await settings(tx));
  const rate = s.cny_to_eur || "0.13";
  const variants: Row[] =
    bundle?.variants ??
    Array.from(
      await tx<
        Row[]
      >`SELECT * FROM shop_variants WHERE product_id=${p.id} ORDER BY id`,
    );
  const fixed = cents(
    String(user.custom_item_fixed_eur ?? s.default_item_fixed_eur ?? "0"),
  );
  const percent = String(
    user.custom_item_percent ?? s.default_item_percent ?? "0",
  );
  const vs = variants.map((v) => {
    const sale = saleCents(
      v.purchase_fen,
      rate,
      v.fee_fixed_cents == null ? fixed : Number(v.fee_fixed_cents),
      v.fee_percent ?? percent,
      String(user.custom_haul_percent ?? s.default_haul_percent ?? "0"),
    );
    return {
      id: v.id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      availability: v.availability,
      price_approved: v.price_approved,
      price_cents: sale,
      price_fen: sale === null ? null : customerFen(sale, rate),
      ...(user.role === "admin" ? { purchase_fen: v.purchase_fen } : {}),
    };
  });
  const media: Row[] =
    bundle?.media ??
    Array.from(
      await tx<
        Row[]
      >`SELECT id,variant_id,alt,position,kind FROM shop_media WHERE product_id=${p.id} ORDER BY position,id`,
    );
  const cats: Row[] =
    bundle?.cats ??
    Array.from(
      await tx<
        Row[]
      >`SELECT category_id FROM shop_product_categories WHERE product_id=${p.id}`,
    );
  const saved = bundle
    ? bundle.saved
    : (
        await tx`SELECT 1 FROM shop_saved WHERE user_id=${user.id} AND product_id=${p.id}`
      ).length > 0;
  return {
    id: p.id,
    title: p.title,
    brand: p.brand,
    description: p.description,
    gender: p.gender,
    category_ids: cats.map((c) => c.category_id),
    material: p.material,
    fit: p.fit,
    // Öffentliche Zusatzinhalte des Listing-Assistenten (Highlights, Pflege, FAQ, Farbmuster ...).
    // In Listen (bundle gesetzt) weggelassen, damit die Antwort klein bleibt.
    listing:
      !bundle && p.listing && typeof p.listing === "object" ? p.listing : {},
    visibility: p.visibility,
    publication: p.publication,
    active: p.active,
    variants: vs,
    media: media.map((m) => ({
      id: m.id,
      variant_id: m.variant_id ?? null,
      alt: m.alt,
      position: m.position,
      kind: m.kind,
      url: `/api/commerce/media/${m.id}`,
    })),
    saved: !!saved,
    notes: bundle
      ? ""
      : (
          await tx`SELECT notes FROM shop_saved WHERE user_id=${user.id} AND product_id=${p.id}`
        )[0]?.notes || "",
    created_at:
      p.created_at instanceof Date
        ? p.created_at.toISOString()
        : p.created_at
          ? String(p.created_at)
          : "",
    ...(p.owner_user_id === user.id
      ? { import_url: p.source_original || p.source_url }
      : {}),
    ...(user.role === "admin"
      ? {
          supplier: p.seller,
          source_url: p.source_original || p.source_url,
          procurement_url: p.procurement_url,
          procurement_links: p.procurement_links,
          purchase_cny: p.price_cny,
        }
      : {}),
  };
}
export async function catalog(user: User, q: URLSearchParams) {
  const tx = database(),
    s = await settings(tx),
    scope = q.get("scope") || "catalog";
  if (scope === "admin") requireAdmin(user);
  const page = integer(q.get("page") || 1, 1, 100000);
  const perPage = q.get("per_page") === "48" ? 48 : 24;
  const descendants = (id: string): string[] => [
    id,
    ...categories.filter((c) => c[1] === id).flatMap((c) => descendants(c[0])),
  ];
  const cat = q.get("category"),
    catIds = cat ? descendants(cat) : [];
  const rate = s.cny_to_eur || "0.13",
    fixed = cents(
      String(user.custom_item_fixed_eur ?? s.default_item_fixed_eur ?? "0"),
    ),
    percent = String(user.custom_item_percent ?? s.default_item_percent ?? "0");
  const itemPrice = tx`(round(v.purchase_fen * ${rate}::numeric) + round(round(v.purchase_fen * ${rate}::numeric) * coalesce(v.fee_percent,${percent}::numeric)/100) + coalesce(v.fee_fixed_cents,${fixed}))`;
  const price = tx`(${itemPrice}+round(${itemPrice}*${String(user.custom_haul_percent ?? s.default_haul_percent ?? "0")}::numeric/100))`;
  const variantWhere = tx`(${!q.get("size")} OR v.size=${q.get("size") || ""}) AND (${!q.get("color")} OR v.color=${q.get("color") || ""}) AND (${!q.get("available")} OR v.availability='available') AND (${!q.get("min")} OR ${price}>=${q.get("min") ? integer(q.get("min"), 0) : 0}) AND (${!q.get("max")} OR ${price}<=${q.get("max") ? integer(q.get("max"), 0) : 100000000})`;
  const access =
    scope === "admin"
      ? q.get("archived") === "1"
        ? tx`p.publication='archived'`
        : tx`p.publication<>'archived'`
      : scope === "imports"
        ? tx`p.owner_user_id=${user.id} AND p.active=1`
        : scope === "saved"
          ? tx`p.active=1 AND (p.owner_user_id=${user.id} OR p.visibility='catalog' AND p.publication='published' OR EXISTS(SELECT 1 FROM shop_collection_items ci JOIN shop_collection_shares cs ON cs.collection_id=ci.collection_id WHERE ci.product_id=p.id AND cs.user_id=${user.id})) AND EXISTS(SELECT 1 FROM shop_saved ss WHERE ss.user_id=${user.id} AND ss.product_id=p.id)`
          : tx`p.visibility='catalog' AND p.publication='published' AND p.active=1`;
  // `exclude` hides one product (used for "Das könnte dir auch gefallen" on the product page).
  const exclude = q.get("exclude") ? integer(q.get("exclude"), 1) : 0;
  const where = tx`${access} AND (${!exclude} OR p.id<>${exclude}) AND (${!q.get("search")} OR (p.title ILIKE ${"%" + (q.get("search") || "") + "%"} OR p.brand ILIKE ${"%" + (q.get("search") || "") + "%"})) AND (${!cat} OR EXISTS(SELECT 1 FROM shop_product_categories pc WHERE pc.product_id=p.id AND pc.category_id=ANY(${catIds}::text[]))) AND (${!q.get("brand")} OR p.brand=${q.get("brand") || ""}) AND (${!q.get("gender")} OR p.gender=${q.get("gender") || ""} OR p.gender='unisex') AND (${!q.get("material")} OR p.material=${q.get("material") || ""}) AND (${!q.get("fit")} OR p.fit=${q.get("fit") || ""}) AND (${!q.get("saved")} OR EXISTS(SELECT 1 FROM shop_saved ss WHERE ss.product_id=p.id AND ss.user_id=${user.id})) AND EXISTS(SELECT 1 FROM shop_variants v WHERE v.product_id=p.id AND ${variantWhere})`;
  const sort =
    q.get("sort") === "price_asc"
      ? tx`(SELECT min(${price}) FROM shop_variants v WHERE v.product_id=p.id AND ${variantWhere}) ASC NULLS LAST,p.id DESC`
      : q.get("sort") === "price_desc"
        ? tx`(SELECT min(${price}) FROM shop_variants v WHERE v.product_id=p.id AND ${variantWhere}) DESC NULLS LAST,p.id DESC`
        : tx`p.id DESC`;
  const [rows, count, facetRows] = await Promise.all([
    tx`SELECT p.* FROM products p WHERE ${where} ORDER BY ${sort} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
    tx`SELECT count(*)::int AS total FROM products p WHERE ${where}`,
    tx`SELECT p.id,p.brand,p.material,p.fit,v.size,v.color FROM products p JOIN shop_variants v ON v.product_id=p.id WHERE ${where} AND ${variantWhere}`,
  ]);
  const ids = rows.map((r) => r.id);
  const [variants, media, cats, saved] = ids.length
    ? await Promise.all([
        tx`SELECT * FROM shop_variants WHERE product_id=ANY(${ids}::int[]) ORDER BY id`,
        tx`SELECT id,product_id,variant_id,alt,position,kind FROM shop_media WHERE product_id=ANY(${ids}::int[]) ORDER BY position,id`,
        tx`SELECT product_id,category_id FROM shop_product_categories WHERE product_id=ANY(${ids}::int[])`,
        tx`SELECT product_id FROM shop_saved WHERE user_id=${user.id} AND product_id=ANY(${ids}::int[])`,
      ])
    : [[], [], [], []];
  const products = await Promise.all(
    rows.map((p) =>
      productDTO(tx, user, p, s, {
        variants: variants.filter((v) => v.product_id === p.id),
        media: media.filter((m) => m.product_id === p.id),
        cats: cats.filter((c) => c.product_id === p.id),
        saved: saved.some((v) => v.product_id === p.id),
      }),
    ),
  );
  const facet = (field: string) =>
    [
      ...new Set<string>(
        facetRows.map((r) => String(r[field] || "")).filter(Boolean),
      ),
    ].sort();
  const facetCounts = (field: string) =>
    Object.fromEntries(
      facet(field).map((value) => [
        value,
        new Set(facetRows.filter((r) => r[field] === value).map((r) => r.id))
          .size,
      ]),
    );
  return {
    products,
    total: count[0].total,
    page,
    per_page: perPage,
    categories: categories.map(([id, parent_id, label]) => ({
      id,
      parent_id,
      label,
    })),
    facets: {
      brands: facet("brand"),
      sizes: facet("size"),
      colors: facet("color"),
      materials: facet("material"),
      fits: facet("fit"),
    },
    facet_counts: {
      brands: facetCounts("brand"),
      sizes: facetCounts("size"),
      colors: facetCounts("color"),
      materials: facetCounts("material"),
      fits: facetCounts("fit"),
    },
  };
}
/**
 * Removes one variant. A variant that already appears in an order is kept (the order
 * history must stay readable) and set to "unavailable" instead, so customers can no
 * longer pick it. Carts that still hold the variant are emptied of it.
 */
async function removeVariant(tx: Sql, variantId: number) {
  const [used] =
    await tx`SELECT 1 AS used FROM shop_order_items WHERE variant_id=${variantId} LIMIT 1`;
  if (used) {
    await tx`UPDATE shop_variants SET availability='unavailable' WHERE id=${variantId}`;
    return { deleted: false, hidden: true, removed_cart_lines: 0 };
  }
  const cart =
    await tx`DELETE FROM shop_cart WHERE variant_id=${variantId} RETURNING id`;
  await tx`UPDATE shop_media SET variant_id=NULL WHERE variant_id=${variantId}`;
  await tx`DELETE FROM shop_variants WHERE id=${variantId}`;
  return { deleted: true, hidden: false, removed_cart_lines: cart.length };
}

async function assertPublishedHasVariant(tx: Sql, p: Row) {
  if (p.publication !== "published") return;
  const [v] =
    await tx`SELECT id FROM shop_variants WHERE product_id=${p.id} AND availability<>'unavailable' LIMIT 1`;
  if (!v)
    throw new PublicError(
      "Ein veröffentlichtes Produkt braucht mindestens eine bestellbare Variante. Setze es zuerst auf Entwurf.",
    );
}

export async function deleteVariant(
  user: User,
  id: number,
  variantId: number,
) {
  requireAdmin(user);
  return transaction(async (tx) => {
    const p = await accessible(tx, user, id);
    const [v] =
      await tx`SELECT id FROM shop_variants WHERE id=${variantId} AND product_id=${id} FOR UPDATE`;
    if (!v) throw new PublicError("Variante nicht gefunden.", 404);
    const result = await removeVariant(tx, variantId);
    await assertPublishedHasVariant(tx, p);
    return {
      ...result,
      product: await productDTO(
        tx,
        user,
        (await tx`SELECT * FROM products WHERE id=${id}`)[0],
      ),
    };
  });
}

function splitList(value: unknown, max: number, itemMax: number): string[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;/]+/)
      : [];
  return [
    ...new Set(
      parts
        .map((s) => String(s ?? "").trim().slice(0, itemMax))
        .filter(Boolean),
    ),
  ].slice(0, max);
}

/** Creates every missing colour × size combination. `replace` first removes the old variants. */
export async function generateVariants(user: User, id: number, body: Row) {
  requireAdmin(user);
  return transaction(async (tx) => {
    const p = await accessible(tx, user, id);
    const colors = splitList(body.colors, 20, 80),
      sizes = splitList(body.sizes, 30, 60);
    if (!colors.length && !sizes.length)
      throw new PublicError("Mindestens eine Farbe oder eine Größe angeben.");
    const wantedColors = colors.length ? colors : [""],
      wantedSizes = sizes.length ? sizes : [""];
    let fen: number | null = null;
    if (body.purchase_cny !== undefined && body.purchase_cny !== null && body.purchase_cny !== "") {
      const cny = Number(body.purchase_cny);
      if (!Number.isFinite(cny) || cny <= 0 || cny > 1_000_000)
        throw new PublicError("Ungültiger Einkaufspreis.");
      fen = Math.round(cny * 100);
    }
    const existing =
      await tx`SELECT id,size,color,purchase_fen FROM shop_variants WHERE product_id=${id} ORDER BY id FOR UPDATE`;
    // Without a typed price, reuse the first price the product already has (not approved again).
    const inherited =
      fen ?? existing.find((v) => v.purchase_fen != null)?.purchase_fen ?? null;
    let hidden = 0,
      removedCart = 0;
    if (body.replace === true) {
      for (const v of existing) {
        const r = await removeVariant(tx, v.id);
        if (r.hidden) hidden++;
        removedCart += r.removed_cart_lines;
      }
    }
    const [{ n }] =
      await tx`SELECT count(*)::int AS n FROM shop_variants WHERE product_id=${id}`;
    if (n + wantedColors.length * wantedSizes.length > 200)
      throw new PublicError("Maximal 200 Varianten pro Produkt.");
    let created = 0;
    for (const color of wantedColors)
      for (const size of wantedSizes) {
        const r =
          await tx`INSERT INTO shop_variants(product_id,size,color,availability,purchase_fen,price_approved) VALUES(${id},${size},${color},'review',${inherited},${fen !== null}) ON CONFLICT(product_id,size,color) DO UPDATE SET availability=CASE WHEN shop_variants.availability='unavailable' THEN 'review' ELSE shop_variants.availability END RETURNING (xmax=0) AS inserted`;
        if (r[0]?.inserted) created++;
      }
    await assertPublishedHasVariant(tx, p);
    return {
      created,
      hidden_in_orders: hidden,
      removed_cart_lines: removedCart,
      product: await productDTO(
        tx,
        user,
        (await tx`SELECT * FROM products WHERE id=${id}`)[0],
      ),
    };
  });
}

export async function saveProduct(user: User, id: number, body: Row) {
  requireAdmin(user);
  return transaction(async (tx) => {
    const p = await accessible(tx, user, id);
    const title = String(body.title ?? p.title)
      .trim()
      .slice(0, 300);
    if (!title) throw new PublicError("Titel erforderlich.");
    const source = String(
      body.source_url ?? p.source_original ?? p.source_url ?? "",
    )
      .trim()
      .slice(0, 2000);
    if (source) {
      let url: URL;
      try {
        url = new URL(source);
      } catch {
        throw new PublicError("Ungültiger Beschaffungslink.");
      }
      if (url.protocol !== "https:" || !isAllowedShopHost(url.hostname))
        throw new PublicError("Nur HTTPS-Beschaffungslinks von Yupoo/Weidian.");
    }
    const requestedLink = String(
      body.procurement_url ?? p.procurement_url ?? "",
    ).trim();
    const orderLink = requestedLink ? procurementUrl(requestedLink) : "";
    if (requestedLink && !orderLink)
      throw new PublicError(
        "Bestelllink muss ein konkreter Taobao- oder Weidian-Artikel sein.",
      );
    const publication = body.publication ?? p.publication;
    if (!["draft", "review", "published", "archived"].includes(publication))
      throw new PublicError("Ungültiger Veröffentlichungsstatus.");
    if (body.visibility && body.visibility !== p.visibility)
      throw new PublicError(
        "Private Produkte über die Veröffentlichungsaktion kopieren.",
      );
    const genders = ["men", "women", "unisex", ""];
    if (body.gender !== undefined && !genders.includes(body.gender))
      throw new PublicError("Ungültige Zielgruppe.");
    await tx`UPDATE products SET procurement_url=${orderLink},source_original=${source},title=${title},brand=${String(body.brand ?? p.brand).slice(0, 120)},description=${String(body.description ?? p.description).slice(0, 10000)},material=${String(body.material ?? p.material).slice(0, 120)},fit=${String(body.fit ?? p.fit).slice(0, 120)},gender=${body.gender ?? p.gender},seller=${String(body.supplier ?? p.seller).slice(0, 120)},publication=${publication},active=${publication === "archived" ? 0 : 1},manual_fields='["title","brand","description","category","gender","procurement_url"]'::jsonb WHERE id=${id}`;
    if (body.category_ids) {
      if (
        !Array.isArray(body.category_ids) ||
        body.category_ids.some(
          (c: string) => !categories.some((x) => x[0] === c),
        )
      )
        throw new PublicError("Ungültige Kategorie.");
      await tx`DELETE FROM shop_product_categories WHERE product_id=${id}`;
      for (const c of body.category_ids)
        await tx`INSERT INTO shop_product_categories(product_id,category_id) VALUES(${id},${c}) ON CONFLICT DO NOTHING`;
    }
    if (body.variants) {
      if (!Array.isArray(body.variants) || body.variants.length > 200)
        throw new PublicError("Maximal 200 Varianten.");
      for (const v of body.variants) {
        const size = String(v.size || "").slice(0, 60),
          color = String(v.color || "").slice(0, 80);
        const availability = v.availability || "review";
        if (!["review", "available", "unavailable"].includes(availability))
          throw new PublicError("Ungültige Verfügbarkeit.");
        const fen =
          v.purchase_fen == null ? null : integer(v.purchase_fen, 1, 100000000);
        if (v.price_approved && fen === null)
          throw new PublicError("Freigegebener Preis fehlt.");
        if (v.id) {
          const found =
            await tx`UPDATE shop_variants SET size=${size},color=${color},sku=${String(v.sku || "").slice(0, 100)},availability=${availability},purchase_fen=${fen},price_approved=${v.price_approved === true} WHERE id=${integer(v.id)} AND product_id=${id} RETURNING id`;
          if (!found.length)
            throw new PublicError("Variante gehört nicht zum Produkt.");
        } else
          await tx`INSERT INTO shop_variants(product_id,size,color,sku,availability,purchase_fen,price_approved) VALUES(${id},${size},${color},${String(v.sku || "").slice(0, 100)},${availability},${fen},${v.price_approved === true}) ON CONFLICT(product_id,size,color) DO UPDATE SET sku=excluded.sku,availability=excluded.availability,purchase_fen=excluded.purchase_fen,price_approved=excluded.price_approved`;
      }
    }
    if (publication === "published") {
      const [v] = await tx`SELECT id FROM shop_variants WHERE product_id=${id}`;
      const [m] = await tx`SELECT id FROM shop_media WHERE product_id=${id}`;
      if (!v || !m)
        throw new PublicError(
          "Vor Veröffentlichung mindestens eine Variante und ein Bild ergänzen.",
        );
    }
    return productDTO(
      tx,
      user,
      (await tx`SELECT * FROM products WHERE id=${id}`)[0],
    );
  });
}
