import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse, PublicError } from "@/lib/server/http";
import { addToCart, getCart } from "@/lib/server/orders";

// GET /api/cart — Warenkorb des eingeloggten Users inkl. Totals.
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  try {
    const cart = await getCart(user);
    return NextResponse.json(cart);
  } catch (err) {
    return errorResponse("cart-get", err);
  }
}

// POST /api/cart — Produkt in den Warenkorb legen.
// Body: { product_id, chosen_size?, color_variant?, quantity? }
export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const productId = parseInt(body.product_id, 10);
    if (isNaN(productId)) throw new PublicError("product_id is required", 400);

    await addToCart(
      user,
      productId,
      body.chosen_size || "",
      body.color_variant || "",
      body.quantity ? Number(body.quantity) : 1
    );
    const cart = await getCart(user);
    return NextResponse.json({ ok: true, ...cart });
  } catch (err) {
    return errorResponse("cart-add", err);
  }
}
