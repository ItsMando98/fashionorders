import type { User } from "../types";
import { PublicError } from "../server/http";
import {
  database,
  transaction,
  ownOrder,
  event,
  requireAdmin,
  type Row,
} from "./core";
import { integer } from "./money";
export async function purchases(user: User, orderId: number): Promise<Row[]> {
  requireAdmin(user);
  const tx = database();
  await ownOrder(tx, user, orderId);
  const orders =
    await tx`SELECT * FROM shop_purchase_orders WHERE order_id=${orderId} ORDER BY id`;
  return Promise.all(
    orders.map(async (po) => ({
      ...po,
      number: `PO-${po.id.toString().padStart(6, "0")}`,
      items:
        await tx`SELECT pi.*,i.title,i.size,i.color,i.sku,i.source_url,i.product_id,coalesce((SELECT sum(si.quantity) FROM shop_shipment_items si WHERE si.purchase_item_id=pi.id),0) AS shipped FROM shop_purchase_items pi JOIN shop_order_items i ON i.id=pi.order_item_id WHERE pi.purchase_order_id=${po.id}`,
    })),
  );
}
export async function createPurchases(user: User, orderId: number) {
  requireAdmin(user);
  return transaction(async (tx) => {
    const o = await ownOrder(tx, user, orderId, true);
    if (
      o.payment_status !== "confirmed" ||
      !["confirmed", "procurement"].includes(o.status)
    )
      throw new PublicError(
        "Beschaffung erst nach bestätigter vollständiger Zahlung.",
        409,
      );
    const items =
      await tx`SELECT i.*,coalesce(nullif(p.procurement_url,''),i.procurement_url) AS order_link,coalesce((SELECT sum(pi.quantity) FROM shop_purchase_items pi JOIN shop_purchase_orders po ON po.id=pi.purchase_order_id WHERE pi.order_item_id=i.id AND po.status<>'cancelled'),0) AS allocated FROM shop_order_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.order_id=${orderId}`;
    const groups = new Map<string, Row[]>();
    for (const i of items) {
      if (!i.supplier || !i.purchase_fen)
        throw new PublicError("Lieferant oder Einkaufspreis fehlt.");
      if (Number(i.allocated) < i.quantity) {
        const group = groups.get(i.supplier) || [];
        group.push(i);
        groups.set(i.supplier, group);
      }
    }
    for (const [supplier, lines] of groups) {
      const [po] =
        await tx`INSERT INTO shop_purchase_orders(order_id,supplier,recipient) VALUES(${orderId},${supplier},coalesce((SELECT concat_ws(' · ',nullif(channel,''),nullif(contact,'')) FROM shop_suppliers WHERE name=${supplier}),'')) RETURNING id`;
      for (const i of lines)
        await tx`INSERT INTO shop_purchase_items(purchase_order_id,order_item_id,quantity,purchase_fen,procurement_url) VALUES(${po.id},${i.id},${i.quantity - Number(i.allocated)},${i.purchase_fen},${i.order_link || ""})`;
    }
    await tx`UPDATE shop_orders SET status='procurement',updated_at=now() WHERE id=${orderId}`;
    if (groups.size)
      await event(tx, user, orderId, "procurement_created", {
        suppliers: groups.size,
      });
  });
}
export async function updatePurchase(
  user: User,
  orderId: number,
  id: number,
  b: Row,
) {
  requireAdmin(user);
  return transaction(async (tx) => {
    await ownOrder(tx, user, orderId, true);
    const [p] =
      await tx`SELECT * FROM shop_purchase_orders WHERE id=${id} AND order_id=${orderId} FOR UPDATE`;
    if (!p) throw new PublicError("Lieferantenauftrag nicht gefunden.", 404);
    const allowed: Record<string, string[]> = {
      draft: ["sent", "cancelled"],
      sent: ["confirmed", "unavailable"],
      confirmed: ["unavailable"],
      unavailable: ["cancelled"],
      cancelled: [],
    };
    if (!allowed[p.status]?.includes(b.status))
      throw new PublicError("Ungültiger Statusübergang.", 409);
    if (b.status === "sent" && !String(b.recipient || "").trim())
      throw new PublicError("Empfänger/Kanal angeben.");
    if (b.status === "confirmed" && !String(b.external_reference || "").trim())
      throw new PublicError("Lieferantenbestellnummer erforderlich.");
    if (b.status === "cancelled") {
      const [s] =
        await tx`SELECT id FROM shop_shipments WHERE purchase_order_id=${id}`;
      if (s)
        throw new PublicError("Bereits versendete Aufträge nicht stornieren.");
    }
    await tx`UPDATE shop_purchase_orders SET status=${b.status},recipient=${String(b.recipient || p.recipient).slice(0, 300)},external_reference=${String(b.external_reference || p.external_reference).slice(0, 200)},sent_at=CASE WHEN ${b.status === "sent"} THEN now() ELSE sent_at END,confirmed_at=CASE WHEN ${b.status === "confirmed"} THEN now() ELSE confirmed_at END WHERE id=${id}`;
    await event(tx, user, orderId, "supplier_" + b.status, { purchase_id: id });
  });
}
export async function shipment(
  user: User,
  orderId: number,
  poId: number,
  b: Row,
) {
  requireAdmin(user);
  return transaction(async (tx) => {
    const o = await ownOrder(tx, user, orderId, true);
    if (o.payment_status !== "confirmed")
      throw new PublicError("Zahlung nicht vollständig bestätigt.");
    const [po] =
      await tx`SELECT * FROM shop_purchase_orders WHERE id=${poId} AND order_id=${orderId} AND status='confirmed'`;
    if (!po)
      throw new PublicError("Bestätigter Lieferantenauftrag erforderlich.");
    if (
      !String(b.carrier || "").trim() ||
      !String(b.tracking || "").trim() ||
      !Array.isArray(b.items) ||
      !b.items.length
    )
      throw new PublicError("Carrier, Tracking und Positionen erforderlich.");
    const seen = new Set<number>();
    for (const l of b.items) {
      const id = integer(l.purchase_item_id);
      if (seen.has(id)) throw new PublicError("Doppelte Position.");
      seen.add(id);
      const [i] =
        await tx`SELECT pi.*,coalesce((SELECT sum(quantity) FROM shop_shipment_items WHERE purchase_item_id=pi.id),0) AS shipped FROM shop_purchase_items pi WHERE pi.id=${id} AND pi.purchase_order_id=${poId}`;
      const qty = integer(l.quantity, 1, 99);
      if (!i || qty + Number(i.shipped) > i.quantity)
        throw new PublicError("Versandmenge übersteigt offene Menge.");
    }
    const [s] =
      await tx`INSERT INTO shop_shipments(order_id,purchase_order_id,carrier,tracking) VALUES(${orderId},${poId},${String(b.carrier).slice(0, 100)},${String(b.tracking).slice(0, 150)}) RETURNING id`;
    for (const i of b.items)
      await tx`INSERT INTO shop_shipment_items(shipment_id,purchase_item_id,quantity) VALUES(${s.id},${i.purchase_item_id},${i.quantity})`;
    await event(tx, user, orderId, "shipped", { shipment_id: s.id });
  });
}
export async function deliver(user: User, orderId: number, id: number) {
  requireAdmin(user);
  return transaction(async (tx) => {
    await ownOrder(tx, user, orderId, true);
    const r =
      await tx`UPDATE shop_shipments SET status='delivered' WHERE id=${id} AND order_id=${orderId} RETURNING id`;
    if (!r.length) throw new PublicError("Sendung nicht gefunden.", 404);
    const pending =
      await tx`SELECT i.id FROM shop_order_items i WHERE i.order_id=${orderId} AND i.quantity>coalesce((SELECT sum(si.quantity) FROM shop_shipment_items si JOIN shop_shipments s ON s.id=si.shipment_id JOIN shop_purchase_items pi ON pi.id=si.purchase_item_id WHERE pi.order_item_id=i.id AND s.status='delivered'),0)`;
    if (!pending.length)
      await tx`UPDATE shop_orders SET status='completed',updated_at=now() WHERE id=${orderId}`;
    await event(tx, user, orderId, "delivered", { shipment_id: id });
  });
}
