import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { checkout, CheckoutInput } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rate-limit";

// POST /api/checkout — Warenkorb -> Order (Snapshot), Warenkorb wird geleert.
// Body: { ship_name, ship_street, ship_zip, ship_city, ship_country, crypto_currency }
// Antwort: die fertige Order inkl. Wallet-Adresse + Betrag (total_eur).
export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const limit = rateLimit(`checkout:${user.id}`, 10, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const currency = String(body.crypto_currency || "").toUpperCase();
    if (!["BTC", "ETH", "USDT"].includes(currency)) {
      throw new PublicError("crypto_currency must be BTC, ETH or USDT.", 400);
    }

    const input: CheckoutInput = {
      ship_name: String(body.ship_name || ""),
      ship_street: String(body.ship_street || ""),
      ship_zip: String(body.ship_zip || ""),
      ship_city: String(body.ship_city || ""),
      ship_country: String(body.ship_country || ""),
      crypto_currency: currency as CheckoutInput["crypto_currency"],
    };

    const order = await checkout(user, input);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return errorResponse("checkout", err);
  }
}
