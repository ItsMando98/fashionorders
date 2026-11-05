import { enabled as commerceEnabled } from "@/lib/commerce/core";
import { commerceRoute } from "@/lib/commerce/api";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, cartItems } from "@/lib/server/db";
import { errorResponse, PublicError } from "@/lib/server/http";
import { getCart } from "@/lib/server/orders";

async function loadOwnCartLine(userId: number, id: number) {
  const row = (
    await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
  )[0];
  if (!row) throw new PublicError("Cart item not found", 404);
  return row;
}

// PATCH /api/cart/[id] — Menge oder Groesse aendern.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (commerceEnabled()) return commerceRoute(request, ['cart', (await params).id]);
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const lineId = parseInt(id, 10);
    if (isNaN(lineId)) throw new PublicError("Invalid cart item ID", 400);
    await loadOwnCartLine(user.id, lineId);

    const body = await request.json();
    const updateValues: Record<string, any> = {};
    if (body.quantity !== undefined) updateValues.quantity = Math.max(1, Math.min(99, Number(body.quantity) || 1));
    if (body.chosen_size !== undefined) updateValues.chosenSize = String(body.chosen_size).slice(0, 60);
    if (body.color_variant !== undefined) updateValues.colorVariant = String(body.color_variant).slice(0, 120);

    if (Object.keys(updateValues).length > 0) {
      await db.update(cartItems).set(updateValues).where(eq(cartItems.id, lineId));
    }
    const cart = await getCart(user);
    return NextResponse.json({ ok: true, ...cart });
  } catch (err) {
    return errorResponse("cart-update", err);
  }
}

// DELETE /api/cart/[id] — Position aus dem Warenkorb entfernen.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (commerceEnabled()) return commerceRoute(request, ['cart', (await params).id]);
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const lineId = parseInt(id, 10);
    if (isNaN(lineId)) throw new PublicError("Invalid cart item ID", 400);
    await loadOwnCartLine(user.id, lineId);

    await db.delete(cartItems).where(eq(cartItems.id, lineId));
    const cart = await getCart(user);
    return NextResponse.json({ ok: true, ...cart });
  } catch (err) {
    return errorResponse("cart-delete", err);
  }
}
