import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { listAllOrdersAdmin } from "@/lib/server/orders";

// GET /api/admin/orders — alle Bestellungen inkl. Kunde + Seller-Daten (Admin).
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  try {
    const orders = await listAllOrdersAdmin();
    return NextResponse.json({ orders });
  } catch (err) {
    return errorResponse("admin-orders-list", err);
  }
}
