import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse, PublicError } from "@/lib/server/http";
import { getFeeSettings } from "@/lib/server/pricing";
import { getProduct, toAdminProduct, toPublicProduct } from "@/lib/server/products";
import { db, products } from "@/lib/server/db";

// GET /api/products/[id] — Kunde: ohne Seller-Felder, Admin: mit Seller-Feldern.
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
    const productId = parseInt(id, 10);
    if (isNaN(productId)) throw new PublicError("Invalid product ID", 400);

    const row = await getProduct(productId);
    if (row.active !== 1 && user.role !== "admin") throw new PublicError("Product not found", 404);

    const feeSettings = await getFeeSettings();
    const mapped =
      user.role === "admin"
        ? toAdminProduct(row, feeSettings, user)
        : toPublicProduct(row, feeSettings, user);
    return NextResponse.json({ product: mapped });
  } catch (err) {
    return errorResponse("products-get", err);
  }
}

// PATCH /api/products/[id] (Admin)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) throw new PublicError("Invalid product ID", 400);
    await getProduct(productId);

    const body = await request.json();
    const updateValues: Record<string, any> = {};
    if (body.title !== undefined) updateValues.title = String(body.title).slice(0, 300);
    if (body.brand !== undefined) updateValues.brand = String(body.brand).slice(0, 120);
    if (body.category !== undefined) updateValues.category = String(body.category).slice(0, 120);
    if (body.available_sizes !== undefined) updateValues.availableSizes = String(body.available_sizes).slice(0, 500);
    if (body.description !== undefined) updateValues.description = String(body.description).slice(0, 5000);
    if (body.price_cny !== undefined) updateValues.priceCny = body.price_cny === null ? null : Number(body.price_cny);
    if (body.seller !== undefined) updateValues.seller = String(body.seller).slice(0, 120);
    if (body.source_url !== undefined) updateValues.sourceUrl = String(body.source_url).slice(0, 500);
    if (body.weidian_url !== undefined) updateValues.weidianUrl = String(body.weidian_url).slice(0, 500);
    if (body.active !== undefined) updateValues.active = body.active ? 1 : 0;
    updateValues.updatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    const updated = (
      await db.update(products).set(updateValues).where(eq(products.id, productId)).returning()
    )[0];

    const feeSettings = await getFeeSettings();
    return NextResponse.json({ ok: true, product: toAdminProduct(updated, feeSettings, user) });
  } catch (err) {
    return errorResponse("products-update", err);
  }
}

// DELETE /api/products/[id] (Admin) — Soft-Delete: active = 0
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) throw new PublicError("Invalid product ID", 400);
    await getProduct(productId);

    await db.update(products).set({ active: 0 }).where(eq(products.id, productId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("products-delete", err);
  }
}
