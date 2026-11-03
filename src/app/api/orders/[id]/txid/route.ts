import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, orders } from "@/lib/server/db";
import { errorResponse, PublicError } from "@/lib/server/http";
import { getOrderItemsRows, getOrderRow, toShopOrder } from "@/lib/server/orders";

// POST /api/orders/[id]/txid — Kunde hinterlegt den TX-Hash seiner Zahlung.
// Body: { txid }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) throw new PublicError("Invalid order ID", 400);

    const row = await getOrderRow(orderId);
    if (row.userId !== user.id) throw new PublicError("Permission denied", 403);
    if (row.status === "cancelled") throw new PublicError("Order is cancelled.", 400);

    const body = await request.json();
    const txid = String(body.txid || "").trim().slice(0, 120);
    if (!txid) throw new PublicError("txid is required", 400);

    await db
      .update(orders)
      .set({
        cryptoTxid: txid,
        updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      .where(eq(orders.id, orderId));

    const updated = await getOrderRow(orderId);
    const items = await getOrderItemsRows(orderId);
    return NextResponse.json({ ok: true, order: toShopOrder(updated, items) });
  } catch (err) {
    return errorResponse("orders-txid", err);
  }
}
