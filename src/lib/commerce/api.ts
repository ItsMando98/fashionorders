import {
  queueCatalogAudit,
  queueNewProductAudit,
  queueMediaWarm,
  applyAudit,
  revertAudit,
  agentConfigured,
  agentConsent,
  agentProvider,
} from "./catalog-agent";
import { cachedMedia, mediaEtag } from "./media-cache";
import { mediaWidth, spreadsheetImage } from "./image-optimization";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import pathUtil from "node:path";
import { getAuthUser } from "../server/auth";
import { PublicError, errorResponse, tooManyAttempts } from "../server/http";
import { rateLimit } from "../server/rate-limit";
import {
  database,
  enabled,
  requireAdmin,
  transaction,
  settings,
  ownOrder,
  publicAddress,
  assertAddress,
  type Row,
  event,
} from "./core";
import {
  catalog,
  accessible,
  productDTO,
  saveProduct,
  deleteVariant,
  generateVariants,
} from "./catalog";
import {
  cart,
  changeCart,
  submitCart,
  listOrders,
  orderDetail,
  createOffer,
  acceptOffer,
  cancelOrder,
} from "./orders";
import { queueImports, importJobs } from "./imports";
import { listingRoute, deleteProductMedia } from "./listing";
import {
  createPayment,
  submitTxid,
  confirmPayment,
  refund,
  saveMethod,
  paymentUri,
} from "./payments";
import {
  purchases,
  createPurchases,
  updatePurchase,
  shipment,
  deliver,
} from "./procurement";
import { storageRequest, uploadSourceImage } from "./storage";
import { integer } from "./money";
import { categories } from "./taxonomy";
async function jsonBody(request: Request) {
  const text = await request.text();
  if (text.length > 1_000_000) throw new PublicError("Anfrage zu groß.", 413);
  try {
    const b = JSON.parse(text || "{}");
    if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error();
    return b as Row;
  } catch {
    throw new PublicError("Ungültige JSON-Anfrage.");
  }
}
export async function commerceRoute(request: Request, path: string[]) {
  try {
    if (!enabled())
      throw new PublicError(
        "Der neue Shop ist noch nicht freigeschaltet.",
        503,
      );
    const user = await getAuthUser(request);
    if (!user) throw new PublicError("Bitte anmelden.", 401);
    const method = request.method,
      url = new URL(request.url);
    const tx = database();
    if (!["GET", "HEAD"].includes(method)) {
      const origin = request.headers.get("origin");
      if (
        origin &&
        new URL(origin).host !== (request.headers.get("host") || url.host)
      )
        throw new PublicError("Fremder Anfrageursprung.", 403);
      const limit = rateLimit(`commerce:${user.id}`, 120, 60000);
      if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);
    }
    const b = ["GET", "HEAD"].includes(method) ? {} : await jsonBody(request);
    const id = path[1] && /^\d+$/.test(path[1]) ? integer(path[1]) : null;
    const json = (data: unknown, status = 200) =>
      NextResponse.json(data, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      });
    if (path[0] === "session" && method === "GET") {
      const s = await settings();
      const [saved] =
        await tx`SELECT count(*)::int AS n FROM shop_saved WHERE user_id=${user.id}`;
      return json({
        user: { id: user.id, name: user.name, role: user.role },
        countries: (s.shop_countries || "DE").split(","),
        operator: s.shop_operator || "",
        tax_note: s.shop_tax_note || "",
        cart: await cart(user),
        saved_count: saved?.n ?? 0,
      });
    }
    if (path[0] === "products") {
      // Only DELETE products/:id archives the product. Longer paths such as
      // products/:id/media/:mediaId or products/:id/variants/:variantId are handled below.
      if (method === "DELETE" && id && !path[2]) {
        requireAdmin(user);
        await tx`UPDATE products SET active=0,publication='archived' WHERE id=${id}`;
        return json({ ok: true });
      }
      if (method === "GET" && !id)
        return json(await catalog(user, url.searchParams));
      if (method === "GET" && id) {
        const [alias] =
          await tx`SELECT target_product_id FROM shop_product_aliases WHERE source_product_id=${id}`;
        if (alias)
          return json({
            product: await productDTO(
              tx,
              user,
              await accessible(tx, user, alias.target_product_id),
            ),
            redirect_product_id: alias.target_product_id,
          });
      }
      if (method === "GET" && id)
        return json({
          product: await productDTO(tx, user, await accessible(tx, user, id)),
          categories: categories.map(([id, parent_id, label]) => ({
            id,
            parent_id,
            label,
          })),
        });
      if (method === "PATCH" && id && path.length === 2)
        return json({ product: await saveProduct(user, id, b) });
      if (method === "POST" && !id) {
        requireAdmin(user);
        const title = String(b.title || "Neues Produkt").slice(0, 300);
        const [p] =
          await tx`INSERT INTO products(title,brand,source_url,visibility,publication) VALUES(${title},'—','','catalog','draft') RETURNING id`;
        await tx`INSERT INTO shop_variants(product_id) VALUES(${p.id})`;
        return json({ id: p.id }, 201);
      }
      if (method === "POST" && id && path[2] === "media") {
        requireAdmin(user);
        const p = await accessible(tx, user, id);
        const bucket =
          p.visibility === "private"
            ? process.env.STORAGE_PRIVATE_BUCKET || "fashion-private"
            : process.env.STORAGE_CATALOG_BUCKET || "fashion-catalog";
        const objectPath = await uploadSourceImage(
          String(b.url),
          String(p.source_url || b.url),
          bucket,
          `products/${id}`,
        );
        await transaction(async (sql) => {
          await sql`INSERT INTO shop_media(product_id,object_path,bucket,alt,position,kind) VALUES(${id},${objectPath},${bucket},${String(b.alt || p.title).slice(0, 300)},${integer(b.position ?? 0, 0, 2147483647)},${b.kind === "size_chart" ? "size_chart" : "product"}) ON CONFLICT DO NOTHING`;
          await queueNewProductAudit(sql, user.id, id);
        });
        return json({ ok: true });
      }
      if (method === "DELETE" && id && path[2] === "variants" && path[3])
        return json(await deleteVariant(user, id, integer(path[3])));
      if (
        method === "POST" &&
        id &&
        path[2] === "variants" &&
        path[3] === "generate"
      )
        return json(await generateVariants(user, id, b));
      if (method === "DELETE" && id && path[2] === "media" && path[3])
        return json(await deleteProductMedia(user, id, integer(path[3])));
      if (method === "PATCH" && id && path[2] === "gallery") {
        requireAdmin(user);
        if (!Array.isArray(b.media))
          throw new PublicError("Ungültige Galerie.");
        await transaction(async (sql) => {
          await accessible(sql, user, id);
          for (const m of b.media) {
            const kind = ["size_chart", "ai_model"].includes(m.kind)
              ? m.kind
              : "product";
            const r =
              await sql`UPDATE shop_media SET position=${integer(m.position, 0, 1000)},alt=${String(m.alt || "").slice(0, 300)},kind=${kind} WHERE id=${integer(m.id)} AND product_id=${id} RETURNING id`;
            if (!r.length)
              throw new PublicError("Bild gehört nicht zum Produkt.");
          }
        });
        return json({ ok: true });
      }
      if (method === "POST" && id && path[2] === "merge") {
        requireAdmin(user);
        if (
          !Array.isArray(b.source_ids) ||
          b.source_ids.length < 1 ||
          b.source_ids.length > 20
        )
          throw new PublicError("1 bis 20 weitere Produkte auswählen.");
        await transaction(async (sql) => {
          const ids = [
            ...new Set([id, ...b.source_ids.map((v: unknown) => integer(v))]),
          ];
          if (ids.length < 2)
            throw new PublicError("Mindestens zwei Produkte auswählen.");
          const products =
            await sql`SELECT * FROM products WHERE id=ANY(${ids}::int[]) ORDER BY id FOR UPDATE`;
          if (
            products.length !== ids.length ||
            products.some((p) => p.visibility !== "catalog")
          )
            throw new PublicError("Nur Shop-Produkte zusammenführen.");
          const albums = new Set(
            products.map(
              (p) => String(p.source_original || p.source_url).split("#")[0],
            ),
          );
          if (albums.size !== 1 || !Array.from(albums)[0])
            throw new PublicError(
              "Nur bestätigte Ansichten desselben Quellalbums zusammenführen.",
            );
          for (const p of products.filter((p) => p.id !== id)) {
            await sql`INSERT INTO shop_media(product_id,bucket,object_path,alt,position,kind) SELECT ${id},bucket,object_path,alt,position+100,kind FROM shop_media WHERE product_id=${p.id} ON CONFLICT DO NOTHING`;
            await sql`UPDATE products SET active=0,publication='archived' WHERE id=${p.id}`;
            await sql`INSERT INTO shop_legacy_mappings(kind,legacy_id,new_id,detail) VALUES('merged_product',${p.id},${id},'{}') ON CONFLICT(kind,legacy_id) DO NOTHING`;
          }
          await event(sql, user, null, "catalog_merged", {
            target: id,
            sources: ids,
          });
        });
        return json({ ok: true });
      }
      if (method === "POST" && id && path[2] === "publish-copy") {
        requireAdmin(user);
        const copyId = await transaction(async (sql) => {
          const p = await accessible(sql, user, id);
          if (p.visibility !== "private")
            throw new PublicError("Nur private Produkte kopieren.");
          const [copy] =
            await sql`INSERT INTO products(title,brand,category,description,seller,source_url,source_original,visibility,publication,material,fit,gender) VALUES(${p.title},${p.brand},${p.category},${p.description},${p.seller},'',${p.source_original || p.source_url},'catalog','draft',${p.material},${p.fit},${p.gender}) RETURNING id`;
          await sql`UPDATE products SET procurement_url=${p.procurement_url},procurement_links=${sql.json(p.procurement_links || [])} WHERE id=${copy.id}`;
          await sql`INSERT INTO shop_variants(product_id,size,color,sku,availability,purchase_fen,price_approved) SELECT ${copy.id},size,color,sku,availability,purchase_fen,price_approved FROM shop_variants WHERE product_id=${id}`;
          await sql`INSERT INTO shop_media(product_id,object_path,bucket,alt,position,kind) SELECT ${copy.id},object_path,bucket,alt,position,kind FROM shop_media WHERE product_id=${id}`;
          await sql`INSERT INTO shop_product_categories(product_id,category_id) SELECT ${copy.id},category_id FROM shop_product_categories WHERE product_id=${id}`;
          await queueNewProductAudit(sql, user.id, copy.id);
          return copy.id;
        });
        return json({ id: copyId }, 201);
      }
    }
    if (
      path[0] === "products" &&
      id &&
      path[2] === "draft" &&
      method === "PATCH"
    ) {
      const p = await accessible(tx, user, id);
      if (p.owner_user_id !== user.id)
        throw new PublicError("Nur eigene Importe bearbeiten.", 403);
      await transaction(async (sql) => {
        if (b.title !== undefined) {
          const title = String(b.title).trim().slice(0, 300);
          if (!title) throw new PublicError("Titel erforderlich.");
          await sql`UPDATE products SET title=${title},manual_fields='["title"]' WHERE id=${id} AND owner_user_id=${user.id}`;
        }
        if (b.size !== undefined) {
          const size = String(b.size).trim().slice(0, 60),
            color = String(b.color || "")
              .trim()
              .slice(0, 80);
          if (!size) throw new PublicError("Gewünschte Größe angeben.");
          const [count] =
            await sql`SELECT count(*)::int AS n FROM shop_variants WHERE product_id=${id}`;
          if (count.n >= 100)
            throw new PublicError("Maximal 100 Variantenhinweise.");
          const [old] =
            await sql`SELECT purchase_fen FROM shop_variants WHERE product_id=${id} ORDER BY id LIMIT 1`;
          await sql`INSERT INTO shop_variants(product_id,size,color,purchase_fen) VALUES(${id},${size},${color},${old?.purchase_fen ?? null}) ON CONFLICT DO NOTHING`;
        }
        if (b.notes !== undefined)
          await sql`INSERT INTO shop_saved(user_id,product_id,notes) VALUES(${user.id},${id},${String(b.notes).slice(0, 2000)}) ON CONFLICT(user_id,product_id) DO UPDATE SET notes=excluded.notes`;
      });
      return json({ ok: true });
    }
    if (path[0] === "media" && id && method === "GET") {
      const [m] = await tx`SELECT * FROM shop_media WHERE id=${id}`;
      if (!m) throw new PublicError("Bild nicht gefunden.", 404);
      await accessible(tx, user, m.product_id);
      const bytes = await cachedMedia(m, mediaWidth(url.searchParams.get("w")));
      const etag = mediaEtag(bytes);
      const headers = {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-cache",
        ETag: etag,
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      };
      if (request.headers.get("if-none-match") === etag)
        return new NextResponse(null, { status: 304, headers });
      return new NextResponse(new Uint8Array(bytes), { headers });
    }
    if (path[0] === "admin" && path[1] === "listing") {
      const result = await listingRoute(user, method, path.slice(2), b);
      return json(result.data, result.status);
    }
    if (path[0] === "admin" && path[1] === "catalog-agent") {
      requireAdmin(user);
      if (method === "GET")
        return json({
          configured: agentConfigured(),
          consent: agentConsent(),
          provider: agentProvider(),
          audits:
            await tx`SELECT id,source_album,status,model,error,created_at,applied_at,result FROM shop_catalog_audits ORDER BY id DESC`,
          jobs: await tx`SELECT kind,status,count(*)::int AS count FROM shop_jobs WHERE kind IN ('catalog_audit','media_warm') GROUP BY kind,status`,
        });
      if (method === "POST" && path[2] === "queue")
        return json(await queueCatalogAudit(user, b.auto_apply !== false), 202);
      if (method === "POST" && path[2] === "warm")
        return json(await queueMediaWarm(user), 202);
      if (method === "POST" && path[2] && path[3] === "apply")
        return json(await applyAudit(user, integer(path[2])));
      if (method === "POST" && path[2] && path[3] === "revert")
        return json(await revertAudit(user, integer(path[2])));
    }
    if (path[0] === "imports") {
      if (method === "GET") return json({ jobs: await importJobs(user) });
      if (method === "POST" && !id)
        return json({ jobs: await queueImports(user, b.urls) }, 202);
      if (method === "POST" && id && path[2] === "retry") {
        const r =
          await tx`UPDATE shop_jobs SET status='queued',attempts=0,error='',available_at=now() WHERE id=${id} AND user_id=${user.id} AND kind='import' AND status='failed' RETURNING id`;
        if (!r.length) throw new PublicError("Import nicht wiederholbar.", 409);
        return json({ ok: true });
      }
    }
    if (path[0] === "saved") {
      const productId = integer(b.product_id ?? id);
      await accessible(tx, user, productId);
      if (method === "POST") {
        await tx`INSERT INTO shop_saved(user_id,product_id,notes) VALUES(${user.id},${productId},${String(b.notes || "").slice(0, 2000)}) ON CONFLICT(user_id,product_id) DO UPDATE SET notes=excluded.notes`;
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await tx`DELETE FROM shop_saved WHERE user_id=${user.id} AND product_id=${productId}`;
        return json({ ok: true });
      }
    }
    if (path[0] === "collections") {
      if (method === "GET") {
        const rows =
          await tx`SELECT * FROM shop_collections WHERE user_id=${user.id} ORDER BY id`;
        return json({
          shared:
            await tx`SELECT c.id,c.name,u.name AS owner,jsonb_agg(jsonb_build_object('product_id',ci.product_id)) FILTER (WHERE ci.product_id IS NOT NULL) AS items FROM shop_collection_shares cs JOIN shop_collections c ON c.id=cs.collection_id JOIN users u ON u.id=c.user_id LEFT JOIN shop_collection_items ci ON ci.collection_id=c.id WHERE cs.user_id=${user.id} GROUP BY c.id,u.name`,
          collections: await Promise.all(
            rows.map(async (c) => ({
              ...c,
              items:
                await tx`SELECT ci.product_id,s.notes FROM shop_collection_items ci LEFT JOIN shop_saved s ON s.product_id=ci.product_id AND s.user_id=${user.id} WHERE ci.collection_id=${c.id}`,
            })),
          ),
        });
      }
      if (method === "POST" && !id) {
        const name = String(b.name || "")
          .trim()
          .slice(0, 100);
        if (!name) throw new PublicError("Name erforderlich.");
        const [c] =
          await tx`INSERT INTO shop_collections(user_id,name) VALUES(${user.id},${name}) RETURNING id`;
        return json(c, 201);
      }
      if (id && path[2] === "shares") {
        const [c] =
          await tx`SELECT id FROM shop_collections WHERE id=${id} AND user_id=${user.id}`;
        if (!c) throw new PublicError("Sammlung nicht gefunden.", 404);
        const [target] =
          await tx`SELECT id FROM users WHERE lower(name)=lower(${String(b.name || "")}) AND disabled=0 AND id<>${user.id}`;
        if (!target) throw new PublicError("Benutzer nicht gefunden.", 404);
        if (method === "POST")
          await tx`INSERT INTO shop_collection_shares(collection_id,user_id) VALUES(${id},${target.id}) ON CONFLICT DO NOTHING`;
        if (method === "DELETE")
          await tx`DELETE FROM shop_collection_shares WHERE collection_id=${id} AND user_id=${target.id}`;
        return json({ ok: true });
      }
      if (id) {
        const [c] =
          await tx`SELECT id FROM shop_collections WHERE id=${id} AND user_id=${user.id}`;
        if (!c) throw new PublicError("Sammlung nicht gefunden.", 404);
        if (path[2] === "items") {
          const p = integer(b.product_id);
          const sharedProduct = await accessible(tx, user, p);
          if (
            sharedProduct.visibility === "private" &&
            sharedProduct.owner_user_id !== user.id
          )
            throw new PublicError(
              "Fremde private Importe nicht weiterteilen.",
              403,
            );
          if (method === "POST")
            await tx`INSERT INTO shop_collection_items(collection_id,product_id) VALUES(${id},${p}) ON CONFLICT DO NOTHING`;
          if (method === "DELETE")
            await tx`DELETE FROM shop_collection_items WHERE collection_id=${id} AND product_id=${p}`;
          return json({ ok: true });
        }
        if (method === "DELETE") {
          await tx`DELETE FROM shop_collections WHERE id=${id} AND user_id=${user.id}`;
          return json({ ok: true });
        }
      }
    }
    if (path[0] === "addresses") {
      if (method === "GET")
        return json({
          addresses:
            await tx`SELECT id,label,address FROM shop_addresses WHERE user_id=${user.id} ORDER BY id`,
        });
      if (method === "POST") {
        const address = publicAddress(b.address || {}),
          s = await settings();
        assertAddress(address, (s.shop_countries || "DE").split(","));
        const [a] =
          await tx`INSERT INTO shop_addresses(user_id,label,address) VALUES(${user.id},${String(b.label || "Adresse").slice(0, 100)},${tx.json(address)}) RETURNING id`;
        return json(a, 201);
      }
      if (method === "DELETE" && id) {
        await tx`DELETE FROM shop_addresses WHERE id=${id} AND user_id=${user.id}`;
        return json({ ok: true });
      }
    }
    if (path[0] === "cart") {
      if (method === "GET") return json(await cart(user));
      if (["POST", "PATCH", "DELETE"].includes(method)) {
        await changeCart(user, b, id || undefined, method === "DELETE");
        return json(await cart(user));
      }
    }
    if (path[0] === "checkout" && method === "POST") {
      const orderId = await submitCart(
        user,
        b,
        request.headers.get("Idempotency-Key") || "",
      );
      return json({ order: await orderDetail(user, orderId) });
    }
    if (path[0] === "orders") {
      if (!id && method === "GET") {
        const old =
          await tx`SELECT id,order_number,status,total_eur,created_at FROM orders WHERE user_id=${user.id} ORDER BY id DESC`;
        const legacy =
          await tx`SELECT id,title,order_status,tracking_number,created_at FROM items WHERE user_id=${user.id} AND stage='submitted' ORDER BY id DESC`;
        return json({
          orders: await listOrders(user),
          legacy_orders: old,
          legacy_items: legacy,
        });
      }
      if (id && method === "GET")
        return json({ order: await orderDetail(user, id) });
      if (id && method === "POST" && path[2] === "offers") {
        await acceptOffer(user, id, integer(b.offer_id));
        return json({ order: await orderDetail(user, id) });
      }
      if (id && method === "POST" && path[2] === "payment-requests") {
        await createPayment(user, id, integer(b.method_id));
        return json({ order: await orderDetail(user, id) });
      }
      if (id && method === "POST" && path[2] === "txid") {
        await submitTxid(user, id, integer(b.payment_id), String(b.txid || ""));
        return json({ order: await orderDetail(user, id) });
      }
      if (id && method === "POST" && path[2] === "cancel") {
        await cancelOrder(user, id);
        return json({ ok: true });
      }
    }
    if (path[0] === "admin") {
      requireAdmin(user);
      if (path[1] === "suppliers") {
        if (method === "GET")
          return json({
            suppliers: await tx`SELECT * FROM shop_suppliers ORDER BY name`,
          });
        if (method === "POST") {
          const name = String(b.name || "")
            .trim()
            .slice(0, 120);
          if (!name) throw new PublicError("Lieferantenname erforderlich.");
          await tx`INSERT INTO shop_suppliers(name,contact,channel,notes,active) VALUES(${name},${String(b.contact || "").slice(0, 300)},${String(b.channel || "").slice(0, 100)},${String(b.notes || "").slice(0, 3000)},${b.active !== false}) ON CONFLICT(name) DO UPDATE SET contact=excluded.contact,channel=excluded.channel,notes=excluded.notes,active=excluded.active`;
          return json({ ok: true });
        }
      }
      if (path[1] === "members" && method === "GET")
        return json({
          members:
            await tx`SELECT id,name,role,custom_item_fixed_eur,custom_item_percent,custom_haul_percent FROM users WHERE disabled=0 ORDER BY name`,
        });
      if (path[1] === "settings") {
        if (method === "GET")
          return json({
            settings: await settings(),
            methods: await tx`SELECT * FROM shop_payment_methods ORDER BY id`,
          });
        if (method === "PATCH") {
          const allowed = [
            "shop_operator",
            "shop_tax_note",
            "shop_countries",
            "cny_to_eur",
            "default_item_fixed_eur",
            "default_item_percent",
            "default_haul_percent",
          ];
          for (const key of allowed)
            if (b[key] !== undefined) {
              const value = String(b[key]).trim().slice(0, 2000);
              if (
                [
                  "cny_to_eur",
                  "default_item_fixed_eur",
                  "default_item_percent",
                  "default_haul_percent",
                ].includes(key) &&
                (!/^\d+(\.\d{1,4})?$/.test(value) ||
                  Number(value) < 0 ||
                  (key === "cny_to_eur" && Number(value) <= 0))
              )
                throw new PublicError("Ungültiger Preisparameter.");
              if (
                key === "shop_countries" &&
                !/^[A-Z]{2}(,[A-Z]{2})*$/.test(value)
              )
                throw new PublicError("Ländercodes wie DE,AT angeben.");
              await tx`INSERT INTO settings(key,value) VALUES(${key},${value}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
            }
          return json({ ok: true });
        }
      }
      if (path[1] === "payment-methods" && method === "POST") {
        await saveMethod(user, b);
        return json({ ok: true });
      }
      if (path[1] === "orders") {
        if (!path[2] && method === "GET")
          return json({ orders: await listOrders(user, true) });
        const orderId = integer(path[2]);
        if (path.length === 3 && method === "GET")
          return json({
            order: await orderDetail(user, orderId),
            purchases: await purchases(user, orderId),
          });
        if (path[3] === "offers" && method === "POST")
          await createOffer(user, orderId, b);
        else if (path[3] === "payments" && method === "POST")
          await confirmPayment(user, orderId, integer(b.payment_id), b);
        else if (path[3] === "refunds" && method === "POST")
          await refund(user, orderId, b);
        else if (path[3] === "purchases" && method === "POST" && !path[4])
          await createPurchases(user, orderId);
        else if (path[3] === "purchases" && method === "PATCH" && path[4])
          await updatePurchase(user, orderId, integer(path[4]), b);
        else if (path[3] === "shipments" && method === "POST")
          await shipment(user, orderId, integer(b.purchase_order_id), b);
        else if (path[3] === "shipments" && method === "PATCH")
          await deliver(user, orderId, integer(b.shipment_id));
        else if (
          path[3] === "purchases" &&
          path[4] &&
          path[5] === "export" &&
          method === "GET"
        ) {
          const o = await ownOrder(tx, user, orderId);
          const po = (await purchases(user, orderId)).find(
            (p) => p.id === integer(path[4]),
          );
          if (!po)
            throw new PublicError("Lieferantenauftrag nicht gefunden.", 404);
          const text = [
            po.number,
            `Lieferant: ${po.supplier}`,
            `Direktversand: ${Object.values(o.address).join(", ")}`,
            ...po.items.map(
              (i: Row) =>
                `${i.quantity} × ${i.title} | ${i.sku} | ${i.size} | ${i.color} | CNY ${(Number(i.purchase_fen) / 100).toFixed(2)} | Bestelllink: ${i.procurement_url || "FEHLT – vor Übergabe prüfen"} | Yupoo/Quelle: ${i.source_url}`,
            ),
          ].join("\n");
          if (url.searchParams.get("format") !== "xlsx")
            return json({ text, number: po.number });
          const wb = new ExcelJS.Workbook();
          const sheet = wb.addWorksheet("Bestellung");
          sheet.addRow([po.number, po.supplier]);
          sheet.addRow(["Direktversand", Object.values(o.address).join(", ")]);
          sheet.addRow([
            "Artikel",
            "SKU",
            "Größe",
            "Farbe",
            "Menge",
            "Einkauf CNY",
            "Bestelllink",
            "Bildquelle",
            "Bildreferenz",
          ]);
          for (const i of po.items) {
            const [m] =
              await tx`SELECT id,bucket,object_path FROM shop_media WHERE product_id=${i.product_id} ORDER BY position,id LIMIT 1`;
            const row = sheet.addRow([
              i.title,
              i.sku,
              i.size,
              i.color,
              i.quantity,
              Number(i.purchase_fen) / 100,
              i.procurement_url || "FEHLT – prüfen",
              i.source_url,
              m
                ? `${process.env.APP_PUBLIC_URL || ""}/api/commerce/media/${m.id}`
                : "",
            ]);
            if (m) {
              try {
                let bytes =
                  m.bucket === "legacy"
                    ? await fs.readFile(
                        pathUtil.join(
                          process.env.FASHION_ORDERS_CACHE ||
                            pathUtil.resolve(".cache_images"),
                          pathUtil.basename(m.object_path),
                        ),
                      )
                    : Buffer.from(
                        await (
                          await storageRequest(
                            `/object/${m.bucket}/${m.object_path}`,
                          )
                        ).arrayBuffer(),
                      );
                if (bytes.subarray(0, 4).toString() === "RIFF")
                  bytes = await spreadsheetImage(bytes);
                const extension =
                  bytes[0] === 0xff && bytes[1] === 0xd8
                    ? "jpeg"
                    : bytes[0] === 0x89 && bytes[1] === 0x50
                      ? "png"
                      : null;
                if (extension) {
                  const image = wb.addImage({
                    base64: `data:image/${extension};base64,${bytes.toString("base64")}`,
                    extension,
                  });
                  sheet.addImage(image, {
                    tl: { col: 8, row: row.number - 1 },
                    ext: { width: 90, height: 90 },
                  });
                  row.height = 72;
                  row.getCell(8).value = "Bild eingebettet";
                } else
                  row.getCell(8).value =
                    "Bild im Quellalbum (Format nicht in Excel einbettbar)";
              } catch {
                row.getCell(8).value = "Bild im Quellalbum prüfen";
              }
            }
          }
          sheet.columns.forEach((c) => {
            c.width = 24;
          });
          const buffer = await wb.xlsx.writeBuffer();
          return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="${po.number}.xlsx"`,
              "Cache-Control": "private, no-store",
            },
          });
        } else throw new PublicError("Aktion nicht gefunden.", 404);
        return json({
          order: await orderDetail(user, orderId),
          purchases: await purchases(user, orderId),
        });
      }
    }
    throw new PublicError("Route nicht gefunden.", 404);
  } catch (e) {
    return errorResponse("commerce", e);
  }
}
