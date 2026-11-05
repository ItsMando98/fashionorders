import postgres from "postgres";
import { categoryFromLegacy } from "../src/lib/commerce/taxonomy";
/** Dry-run is the default. Run only after restoring a backup into staging. */
export async function migrateData(url: string, apply = false) {
  const sql = postgres(url, { max: 1 });
  try {
    const [counts] =
      await sql`SELECT (SELECT count(*) FROM products)::int products,(SELECT count(*) FROM items)::int items,(SELECT count(*) FROM orders)::int orders,(SELECT count(*) FROM gram_posts)::int posts`;
    if (!apply) return { mode: "dry-run", ...counts };
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(716230002)`;
      const products =
        await tx`SELECT * FROM products WHERE visibility='catalog' ORDER BY id`;
      for (const p of products) {
        const [done] =
          await tx`SELECT 1 FROM shop_legacy_mappings WHERE kind='catalog' AND legacy_id=${p.id}`;
        if (done) continue;
        // Old sizes are hints, not inventory. Photo-products remain separate review drafts.
        const sizes = String(p.available_sizes || "")
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter((s) => s && !/standard|see |S, M|unknown/i.test(s))
          .slice(0, 100);
        for (const size of sizes.length ? sizes : ["Noch festzulegen"])
          await tx`INSERT INTO shop_variants(product_id,size,purchase_fen) VALUES(${p.id},${size},${p.price_cny > 0 ? Math.round(p.price_cny * 100) : null}) ON CONFLICT DO NOTHING`;
        const category = categoryFromLegacy(
          p.category || "",
          p.subcategory || "",
        );
        if (category)
          await tx`INSERT INTO shop_product_categories(product_id,category_id) VALUES(${p.id},${category}) ON CONFLICT DO NOTHING`;
        if (p.local_image)
          await tx`INSERT INTO shop_media(product_id,bucket,object_path,alt) VALUES(${p.id},'legacy',${p.local_image.split("/").pop()},${p.title}) ON CONFLICT DO NOTHING`;
        await tx`INSERT INTO shop_legacy_mappings(kind,legacy_id,new_id,detail) VALUES('catalog',${p.id},${p.id},${tx.json({ needs_review: true, photo_product: p.source_url.includes("#") })})`;
      }
      const items = await tx`SELECT * FROM items ORDER BY id`;
      for (const i of items) {
        const [done] =
          await tx`SELECT 1 FROM shop_legacy_mappings WHERE kind='item' AND legacy_id=${i.id}`;
        if (done) continue;
        const source = `legacy:item:${i.id}`;
        const [p] =
          await tx`INSERT INTO products(title,brand,category,description,source_url,source_original,seller,owner_user_id,visibility,publication) VALUES(${i.title},${i.brand},${i.category},${i.description || ""},${source},${i.url || ""},${i.seller || ""},${i.user_id},'private','review') RETURNING id`;
        const [v] =
          await tx`INSERT INTO shop_variants(product_id,size,color,purchase_fen,fee_fixed_cents,fee_percent) VALUES(${p.id},${i.chosen_size || "Noch festzulegen"},${i.color_variant || ""},${i.price_cny > 0 ? Math.round(i.price_cny * 100) : null},${i.custom_fee_fixed_eur == null ? null : Math.round(i.custom_fee_fixed_eur * 100)},${i.custom_fee_percent}) RETURNING id`;
        await tx`INSERT INTO shop_saved(user_id,product_id,notes) VALUES(${i.user_id},${p.id},${i.user_notes || ""})`;
        if (i.local_image)
          await tx`INSERT INTO shop_media(product_id,bucket,object_path,alt) VALUES(${p.id},'legacy',${i.local_image.split("/").pop()},${i.title}) ON CONFLICT DO NOTHING`;
        if (i.stage === "cart")
          await tx`INSERT INTO shop_cart(user_id,variant_id,quantity) VALUES(${i.user_id},${v.id},${Math.max(1, Math.min(99, Math.trunc(i.quantity || 1)))})`;
        await tx`INSERT INTO shop_legacy_mappings(kind,legacy_id,new_id,detail) VALUES('item',${i.id},${p.id},${tx.json({ original_url: i.url, stage: i.stage, status: i.order_status, tracking: i.tracking_number, created_at: i.created_at, admin_notes: i.admin_notes, quantity: i.quantity, requires_historical_review: i.stage === "submitted" })})`;
      }
      const legacyCart =
        await tx`SELECT c.*,p.price_cny FROM cart_items c JOIN products p ON p.id=c.product_id ORDER BY c.id`;
      for (const c of legacyCart) {
        const [done] =
          await tx`SELECT 1 FROM shop_legacy_mappings WHERE kind='cart' AND legacy_id=${c.id}`;
        if (done) continue;
        const size = String(c.chosen_size || "Noch festzulegen"),
          color = String(c.color_variant || "");
        const [v] =
          await tx`INSERT INTO shop_variants(product_id,size,color,purchase_fen) VALUES(${c.product_id},${size},${color},${c.price_cny > 0 ? Math.round(c.price_cny * 100) : null}) ON CONFLICT(product_id,size,color) DO UPDATE SET product_id=excluded.product_id RETURNING id`;
        const [existing] =
          await tx`SELECT quantity FROM shop_cart WHERE user_id=${c.user_id} AND variant_id=${v.id}`;
        const quantity = Number(c.quantity) + (existing?.quantity || 0);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
          throw new Error(
            `Legacy cart ${c.id} requires quantity review before migration.`,
          );
        const [line] =
          await tx`INSERT INTO shop_cart(user_id,variant_id,quantity) VALUES(${c.user_id},${v.id},${quantity}) ON CONFLICT(user_id,variant_id) DO UPDATE SET quantity=excluded.quantity RETURNING id`;
        await tx`INSERT INTO shop_legacy_mappings(kind,legacy_id,new_id,detail) VALUES('cart',${c.id},${line.id},${tx.json({ quantity: c.quantity, size, color })})`;
      }
      // Preserve real historical orders verbatim in the mapping. Do not synthesize payments or reprice.
      const orders = await tx`SELECT * FROM orders ORDER BY id`;
      for (const o of orders) {
        const lines =
          await tx`SELECT * FROM order_items WHERE order_id=${o.id}`;
        await tx`INSERT INTO shop_legacy_mappings(kind,legacy_id,detail) VALUES('order',${o.id},${tx.json({ order: o, items: lines })}) ON CONFLICT DO NOTHING`;
      }
      return { mode: "applied", ...counts };
    });
  } finally {
    await sql.end();
  }
}
if (process.argv[1]?.endsWith("migrate-commerce-data.ts")) {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL required.");
  migrateData(url, process.argv.includes("--apply"))
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
