import { enabled as commerceEnabled } from "@/lib/commerce/core";
import { commerceRoute } from "@/lib/commerce/api";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { listOrdersForUser } from "@/lib/server/orders";

// GET /api/orders — eigene Bestellungen (neueste zuerst), ohne Seller-Daten.
export async function GET(request: Request) {
  if (commerceEnabled()) return commerceRoute(request, ['orders']);
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  try {
    const orders = await listOrdersForUser(user);
    return NextResponse.json({ orders });
  } catch (err) {
    return errorResponse("orders-list", err);
  }
}
