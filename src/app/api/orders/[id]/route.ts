import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse, PublicError } from "@/lib/server/http";
import { getOrderItemsRows, getOrderRow, toShopOrder } from "@/lib/server/orders";

// GET /api/orders/[id] — eigene Order im Detail (Owner oder Admin).
export async function GET(
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
    if (row.userId !== user.id && user.role !== "admin") {
      throw new PublicError("Permission denied", 403);
    }
    const items = await getOrderItemsRows(orderId);
    return NextResponse.json({ order: toShopOrder(row, items) });
  } catch (err) {
    return errorResponse("orders-get", err);
  }
}
