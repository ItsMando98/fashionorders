import crypto from "node:crypto";
import type { User } from "../types";
import { PublicError } from "../server/http";
import {
  database,
  transaction,
  event,
  hash,
  ownOrder,
  publicAddress,
  assertAddress,
  settings,
  requireAdmin,
  type Row,
} from "./core";
import { accessible, productDTO } from "./catalog";
import { integer, saleCents, cents, customerFen } from "./money";
export async function lockCart(tx: ReturnType<typeof database>, user: User) {
  await tx`INSERT INTO shop_cart_versions(user_id) VALUES(${user.id}) ON CONFLICT DO NOTHING`;
  return (
    await tx`SELECT version FROM shop_cart_versions WHERE user_id=${user.id} FOR UPDATE`
  )[0].version as number;
}
export async function cart(user: User) {
  const tx = database();
  const [v] =
    await tx`SELECT version FROM shop_cart_versions WHERE user_id=${user.id}`;
  const rows =
    await tx`SELECT c.*,v.product_id FROM shop_cart c JOIN shop_variants v ON v.id=c.variant_id WHERE c.user_id=${user.id} ORDER BY c.id`;
  const products = new Map<number, Awaited<ReturnType<typeof productDTO>>>();
  const s = await settings(tx);
  for (const r of rows)
    if (!products.has(r.product_id)) {
      try {
        products.set(
          r.product_id,
          await productDTO(
            tx,
            user,
            await accessible(tx, user, r.product_id),
            s,
          ),
        );
      } catch (e) {
        if (!(e instanceof PublicError) || e.status !== 404) throw e;
      }
    }
  return {
    version: v?.version || 0,
    lines: rows.map((r) => {
      const p = products.get(r.product_id);
      if (!p)
        return {
          id: r.id,
          product_id: r.product_id,
          title: "Artikel nicht mehr verfügbar – bitte neu auswählen",
          image: "",
          variant: {
            id: r.variant_id,
            size: "",
            color: "",
            sku: "",
            availability: "unavailable",
            price_approved: false,
            price_cents: null,
            price_fen: null,
          },
          quantity: r.quantity,
          estimated_cents: null,
        };
      const v = p.variants.find((v) => v.id === r.variant_id)!;
      return {
        id: r.id,
        product_id: p.id,
        title: p.title,
        image: p.media[0]?.url || "",
        variant: v,
        quantity: r.quantity,
        estimated_cents:
          v.price_cents === null ? null : v.price_cents * r.quantity,
      };
    }),
  };
}
export async function changeCart(
  user: User,
  body: Row,
  id?: number,
  remove = false,
) {
  return transaction(async (tx) => {
    await lockCart(tx, user);
    if (id) {
      const [line] =
        await tx`SELECT * FROM shop_cart WHERE id=${id} AND user_id=${user.id}`;
      if (!line)
        throw new PublicError("Warenkorbposition nicht gefunden.", 404);
      if (remove)
        await tx`DELETE FROM shop_cart WHERE id=${id} AND user_id=${user.id}`;
      else
        await tx`UPDATE shop_cart SET quantity=${integer(body.quantity, 1, 99)} WHERE id=${id} AND user_id=${user.id}`;
    } else {
      const [v] =
        await tx`SELECT * FROM shop_variants WHERE id=${integer(body.variant_id)}`;
      if (!v) throw new PublicError("Variante nicht gefunden.", 404);
      await accessible(tx, user, v.product_id);
      if (v.availability === "unavailable")
        throw new PublicError("Variante nicht verfügbar.");
      const qty = integer(body.quantity ?? 1, 1, 99);
      const [old] =
        await tx`SELECT quantity FROM shop_cart WHERE user_id=${user.id} AND variant_id=${v.id}`;
      const sum = qty + (old?.quantity || 0);
      integer(sum, 1, 99);
      await tx`INSERT INTO shop_cart(user_id,variant_id,quantity) VALUES(${user.id},${v.id},${sum}) ON CONFLICT(user_id,variant_id) DO UPDATE SET quantity=excluded.quantity`;
    }
    await tx`UPDATE shop_cart_versions SET version=version+1 WHERE user_id=${user.id}`;
  });
}
export async function submitCart(user: User, body: Row, key: string) {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key))
    throw new PublicError("Idempotency-Key erforderlich.");
  const address = publicAddress(body.address || {});
  const requestHash = hash({ address, version: body.version });
  return transaction(async (tx) => {
    const version = await lockCart(tx, user);
    const [old] =
      await tx`SELECT * FROM shop_orders WHERE user_id=${user.id} AND idempotency_key=${key}`;
    if (old) {
      if (old.request_hash !== requestHash)
        throw new PublicError(
          "Schlüssel bereits für andere Anfrage verwendet.",
          409,
        );
      return old.id as number;
    }
    if (version !== integer(body.version, 0))
      throw new PublicError("Warenkorb wurde geändert. Bitte neu laden.", 409);
    const s = await settings(tx);
    assertAddress(address, (s.shop_countries || "DE").split(","));
    const rows =
      await tx`SELECT c.id,c.quantity,v.id AS variant_id,v.size,v.color,v.sku,v.availability,v.purchase_fen,v.fee_fixed_cents,v.fee_percent,v.product_id,p.title,p.seller,p.procurement_url,coalesce(nullif(p.source_original,''),p.source_url) AS source_url,p.active,p.owner_user_id,p.visibility,p.publication FROM shop_cart c JOIN shop_variants v ON v.id=c.variant_id JOIN products p ON p.id=v.product_id WHERE c.user_id=${user.id} ORDER BY c.id FOR SHARE OF v,p`;
    if (!rows.length) throw new PublicError("Dein Warenkorb ist leer.");
    for (const r of rows) {
      await accessible(tx, user, r.product_id);
      if (r.active !== 1 || r.availability === "unavailable")
        throw new PublicError(
          "Ein Artikel kann nicht mehr angefragt werden.",
          409,
        );
    }
    const [order] =
      await tx`INSERT INTO shop_orders(number,user_id,address,idempotency_key,request_hash) VALUES(${"FS-" + new Date().getFullYear() + "-" + crypto.randomBytes(5).toString("hex").toUpperCase()},${user.id},${tx.json(address)},${key},${requestHash}) RETURNING id`;
    for (const r of rows) {
      const price = saleCents(
        r.purchase_fen,
        s.cny_to_eur || "0.13",
        r.fee_fixed_cents == null
          ? cents(
              String(
                user.custom_item_fixed_eur ?? s.default_item_fixed_eur ?? "0",
              ),
            )
          : Number(r.fee_fixed_cents),
        String(
          r.fee_percent ??
            user.custom_item_percent ??
            s.default_item_percent ??
            "0",
        ),
        String(user.custom_haul_percent ?? s.default_haul_percent ?? "0"),
      );
      await tx`INSERT INTO shop_order_items(order_id,product_id,variant_id,title,size,color,sku,quantity,supplier,source_url,procurement_url,purchase_fen,requested_cents,notes) VALUES(${order.id},${r.product_id},${r.variant_id},${r.title},${r.size},${r.color},${r.sku},${r.quantity},${r.seller || ""},${r.source_url || ""},${r.procurement_url || ""},${r.purchase_fen},${price},coalesce((SELECT notes FROM shop_saved WHERE user_id=${user.id} AND product_id=${r.product_id}),''))`;
    }
    await tx`DELETE FROM shop_cart WHERE user_id=${user.id} AND id IN ${tx(rows.map((r) => r.id))}`;
    await tx`UPDATE shop_cart_versions SET version=version+1 WHERE user_id=${user.id}`;
    await event(tx, user, order.id, "submitted");
    return order.id as number;
  });
}
export async function listOrders(user: User, admin = false) {
  if (admin) requireAdmin(user);
  const tx = database();
  const rows =
    await tx`SELECT o.*,u.name AS user_name FROM shop_orders o JOIN users u ON u.id=o.user_id WHERE (${admin} OR o.user_id=${user.id}) ORDER BY o.id DESC LIMIT 300`;
  return rows.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    payment_status: o.payment_status,
    created_at: o.created_at,
    ...(admin ? { user_name: o.user_name } : {}),
  }));
}
export async function orderDetail(user: User, id: number) {
  const tx = database();
  const o = await ownOrder(tx, user, id);
  const items =
    await tx`SELECT * FROM shop_order_items WHERE order_id=${id} ORDER BY id`;
  const offers =
    await tx`SELECT * FROM shop_offers WHERE order_id=${id} ORDER BY version DESC`;
  const payments =
    await tx`SELECT * FROM shop_payment_requests WHERE order_id=${id} ORDER BY id DESC`;
  const shipments =
    await tx`SELECT s.*,coalesce(jsonb_agg(jsonb_build_object('item_id',pi.order_item_id,'quantity',si.quantity)) FILTER (WHERE si.purchase_item_id IS NOT NULL),'[]') AS items FROM shop_shipments s LEFT JOIN shop_shipment_items si ON si.shipment_id=s.id LEFT JOIN shop_purchase_items pi ON pi.id=si.purchase_item_id WHERE s.order_id=${id} GROUP BY s.id ORDER BY s.id`;
  const methods =
    await tx`SELECT id,currency,network FROM shop_payment_methods WHERE enabled=true AND currency IN ('BTC','USDC')`;
  const events =
    await tx`SELECT id,type,created_at FROM shop_events WHERE order_id=${id} ORDER BY id`;
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    payment_status: o.payment_status,
    address: o.address,
    accepted_offer_id: o.accepted_offer_id,
    created_at: o.created_at,
    items: items.map((i) => ({
      id: i.id,
      product_id: i.product_id,
      title: i.title,
      size: i.size,
      color: i.color,
      sku: i.sku,
      quantity: i.quantity,
      notes: i.notes,
      estimated_cents: i.requested_cents,
      ...(user.role === "admin"
        ? {
            supplier: i.supplier,
            source_url: i.source_url,
            procurement_url: i.procurement_url,
            purchase_fen: i.purchase_fen,
          }
        : {}),
    })),
    offers: offers.map((f) => ({
      id: f.id,
      version: f.version,
      lines: f.lines,
      shipping_cents: Number(f.shipping_cents),
      total_cents: Number(f.total_cents),
      cny_to_eur: f.cny_to_eur,
      total_fen: customerFen(Number(f.total_cents), f.cny_to_eur),
      delivery_note: f.delivery_note,
      expires_at: f.expires_at,
      accepted_at: f.accepted_at,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      currency: p.currency,
      network: p.network,
      address: p.address,
      token_contract: p.token_contract,
      decimals: p.decimals,
      amount_atoms: p.amount_atoms,
      rate_eur: p.rate_eur,
      total_cents: Number(p.total_cents),
      status: p.status,
      txid: p.txid,
      exception: p.exception,
      expires_at: p.expires_at,
    })),
    shipments,
    events,
    methods,
  };
}
export async function createOffer(user: User, id: number, body: Row) {
  requireAdmin(user);
  return transaction(async (tx) => {
    const o = await ownOrder(tx, user, id, true);
    if (!["review", "offered"].includes(o.status) || o.accepted_offer_id)
      throw new PublicError(
        "Angenommene Bestellung kann nicht neu angeboten werden.",
        409,
      );
    const items =
      await tx`SELECT * FROM shop_order_items WHERE order_id=${id} ORDER BY id`;
    if (!Array.isArray(body.lines) || body.lines.length !== items.length)
      throw new PublicError("Alle Positionen müssen geprüft werden.");
    const seen = new Set<number>();
    const lines = body.lines.map((l: Row) => {
      const i = items.find((i) => i.id === integer(l.item_id));
      if (!i || seen.has(i.id))
        throw new PublicError("Ungültige Angebotsposition.");
      seen.add(i.id);
      if (!String(l.supplier || i.supplier).trim())
        throw new PublicError("Lieferant erforderlich.");
      integer(l.purchase_fen ?? i.purchase_fen, 1, 100000000);
      const size = String(l.size ?? i.size)
          .trim()
          .slice(0, 60),
        color = String(l.color ?? i.color)
          .trim()
          .slice(0, 80),
        sku = String(l.sku ?? i.sku)
          .trim()
          .slice(0, 100);
      if (!size || /noch festzulegen|standard sizes|see /i.test(size))
        throw new PublicError("Konkrete Größe vor dem Angebot bestätigen.");
      return {
        item_id: i.id,
        title: i.title,
        size,
        color,
        sku,
        quantity: i.quantity,
        unit_cents: integer(l.unit_cents, 1, 100000000),
      };
    });
    for (const l of body.lines) {
      const name = String(
        l.supplier ||
          items.find((i) => i.id === integer(l.item_id))?.supplier ||
          "",
      )
        .trim()
        .slice(0, 120);
      await tx`INSERT INTO shop_suppliers(name) VALUES(${name}) ON CONFLICT DO NOTHING`;
      const [supplier] =
        await tx`SELECT active FROM shop_suppliers WHERE name=${name}`;
      if (!supplier.active) throw new PublicError("Lieferant ist deaktiviert.");
    }
    for (const l of body.lines) {
      const checked = lines.find(
        (line: Row) => line.item_id === integer(l.item_id),
      )!;
      await tx`UPDATE shop_order_items SET size=${checked.size},color=${checked.color},sku=${checked.sku},supplier=${String(l.supplier || items.find((i) => i.id === l.item_id)?.supplier || "").slice(0, 120)},purchase_fen=${integer(l.purchase_fen ?? items.find((i) => i.id === l.item_id)?.purchase_fen, 1, 100000000)} WHERE id=${l.item_id} AND order_id=${id}`;
    }
    const s = await settings(tx);
    if (!s.shop_operator || !s.shop_tax_note)
      throw new PublicError(
        "Betreiber- und Steuerangaben zuerst in den Shop-Einstellungen hinterlegen.",
      );
    const shipping = integer(body.shipping_cents, 0, 100000000),
      total = lines.reduce(
        (n: number, l: Row) => n + l.unit_cents * l.quantity,
        shipping,
      );
    integer(total, 1, 100000000);
    const delivery = String(body.delivery_note || "")
      .trim()
      .slice(0, 2000);
    if (!delivery) throw new PublicError("Liefererwartung erforderlich.");
    const [version] =
      await tx`SELECT coalesce(max(version),0)+1 AS n FROM shop_offers WHERE order_id=${id}`;
    await tx`INSERT INTO shop_offers(order_id,version,lines,shipping_cents,total_cents,cny_to_eur,delivery_note,expires_at) VALUES(${id},${version.n},${tx.json(lines)},${shipping},${total},${s.cny_to_eur || "0.13"},${delivery},now()+interval '48 hours')`;
    await tx`UPDATE shop_orders SET status='offered',updated_at=now() WHERE id=${id}`;
    await event(tx, user, id, "offered", { version: version.n });
  });
}
export async function acceptOffer(user: User, id: number, offerId: number) {
  return transaction(async (tx) => {
    const o = await ownOrder(tx, user, id, true);
    if (o.user_id !== user.id)
      throw new PublicError("Nur der Kunde kann das Angebot annehmen.", 403);
    if (o.accepted_offer_id === offerId) return;
    if (o.status !== "offered" || o.accepted_offer_id)
      throw new PublicError("Angebot nicht annehmbar.", 409);
    const [offer] =
      await tx`SELECT * FROM shop_offers WHERE order_id=${id} ORDER BY version DESC LIMIT 1`;
    if (
      !offer ||
      offer.id !== offerId ||
      new Date(offer.expires_at) <= new Date()
    )
      throw new PublicError("Angebot geändert oder abgelaufen.", 409);
    await tx`UPDATE shop_offers SET accepted_at=now() WHERE id=${offerId}`;
    await tx`UPDATE shop_orders SET status='confirmed',accepted_offer_id=${offerId},updated_at=now() WHERE id=${id}`;
    await event(tx, user, id, "accepted", { offer_id: offerId });
  });
}
export async function cancelOrder(user: User, id: number) {
  return transaction(async (tx) => {
    const o = await ownOrder(tx, user, id, true);
    const [p] =
      await tx`SELECT id FROM shop_payment_requests WHERE order_id=${id} AND (txid IS NOT NULL OR status='confirmed') LIMIT 1`;
    if (!["review", "offered", "confirmed"].includes(o.status) || p)
      throw new PublicError(
        "Für diese Bestellung ist eine manuelle Zahlungs-/Stornoprüfung erforderlich.",
        409,
      );
    await tx`UPDATE shop_orders SET status='cancelled',updated_at=now() WHERE id=${id}`;
    await event(tx, user, id, "cancelled");
  });
}
