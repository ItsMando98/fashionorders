import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, cartItems } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";
import { getShopSettings } from "@/lib/server/pricing";

// GET /api/shop/settings — oeffentliche Shop-Settings fuer die Storefront
// (Kurs, Versandkosten, Wallet-Adressen fuer den manuellen Crypto-Checkout)
// plus Basis-Userinfo + Warenkorb-Anzahl fuer die Shop-Navigation.
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const shopSettings = await getShopSettings();
    const countRows = await db
      .select({ count: sql<number>`coalesce(sum(quantity), 0)::int` })
      .from(cartItems)
      .where(eq(cartItems.userId, user.id));
    return NextResponse.json({
      shop_settings: shopSettings,
      user: { id: user.id, name: user.name, role: user.role },
      cart_count: countRows[0]?.count ?? 0,
    });
  } catch (err) {
    return errorResponse("shop-settings", err);
  }
}
