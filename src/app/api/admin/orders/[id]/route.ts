import { enabled as commerceEnabled } from "@/lib/commerce/core";
import { commerceRoute } from "@/lib/commerce/api";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, orders, orderItems, users } from "@/lib/server/db";
import { errorResponse, PublicError } from "@/lib/server/http";
import {
  getOrderItemsRows,
  getOrderRow,
  toAdminShopOrder,
  ORDER_STATUSES,
} from "@/lib/server/orders";

const nowUtc = () => new Date().toISOString().slice(0, 19).replace("T", " ");

// PATCH /api/admin/orders/[id] — Status, Zahlung bestaetigen, Tracking, Notizen.
// Body: { status?, confirm_payment?, tracking_number?, admin_notes?,
//         item_updates?: [{ id, fulfillment_status?, tracking_number? }] }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (commerceEnabled()) return commerceRoute(request, ['admin', 'orders', (await params).id]);
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) throw new PublicError("Invalid order ID", 400);
    await getOrderRow(orderId);

    const body = await request.json();
    const updateValues: Record<string, any> = {};

    if (body.confirm_payment === true) {
      // Manueller Crypto-Flow: Admin bestaetigt den Zahlungseingang.
      updateValues.status = "paid";
    } else if (body.status !== undefined) {
      if (!ORDER_STATUSES.includes(body.status)) {
        throw new PublicError(`Invalid status. Allowed: ${ORDER_STATUSES.join(", ")}`, 400);
      }
      updateValues.status = body.status;
    }
    if (body.tracking_number !== undefined) updateValues.trackingNumber = String(body.tracking_number).slice(0, 120);
    if (body.admin_notes !== undefined) updateValues.adminNotes = String(body.admin_notes).slice(0, 2000);

    if (Object.keys(updateValues).length > 0) {
      updateValues.updatedAt = nowUtc();
      await db.update(orders).set(updateValues).where(eq(orders.id, orderId));
    }

    // Einzelne Positionen aktualisieren (Fulfillment / Tracking pro Item)
    if (Array.isArray(body.item_updates)) {
      for (const upd of body.item_updates.slice(0, 100)) {
        const itemId = parseInt(upd.id, 10);
        if (isNaN(itemId)) continue;
        const itemValues: Record<string, any> = {};
        if (upd.fulfillment_status !== undefined) {
          itemValues.fulfillmentStatus = String(upd.fulfillment_status).slice(0, 60);
        }
        if (upd.tracking_number !== undefined) {
          itemValues.trackingNumber = String(upd.tracking_number).slice(0, 120);
        }
        if (Object.keys(itemValues).length > 0) {
          await db
            .update(orderItems)
            .set(itemValues)
            .where(eq(orderItems.id, itemId));
        }
      }
    }

    const updated = await getOrderRow(orderId);
    const items = await getOrderItemsRows(orderId);
    const owner = (
      await db.select({ name: users.name }).from(users).where(eq(users.id, updated.userId))
    )[0];
    return NextResponse.json({
      ok: true,
      order: toAdminShopOrder(updated, items, owner?.name || "Unknown"),
    });
  } catch (err) {
    return errorResponse("admin-orders-update", err);
  }
}
