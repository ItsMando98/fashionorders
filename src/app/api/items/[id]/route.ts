import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, items } from "@/lib/server/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) {
    return NextResponse.json({ detail: "Invalid item ID" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .get();

  if (!existing) {
    return NextResponse.json({ detail: "Item not found" }, { status: 404 });
  }

  const isOwner = existing.userId === user.id;
  const isAdmin = user.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updateValues: Record<string, any> = {};

    if (body.chosen_size !== undefined) updateValues.chosenSize = body.chosen_size;
    if (body.quantity !== undefined) updateValues.quantity = Math.max(1, Number(body.quantity));
    if (body.user_notes !== undefined) updateValues.userNotes = body.user_notes;
    if (body.is_shared !== undefined) updateValues.isShared = body.is_shared ? 1 : 0;
    if (body.stage !== undefined) updateValues.stage = body.stage;

    if (isAdmin) {
      if (body.order_status !== undefined) updateValues.orderStatus = body.order_status;
      if (body.admin_notes !== undefined) updateValues.adminNotes = body.admin_notes;
      if (body.tracking_number !== undefined) updateValues.trackingNumber = body.tracking_number;
      if (body.custom_fee_fixed_eur !== undefined) updateValues.customFeeFixedEur = body.custom_fee_fixed_eur;
      if (body.custom_fee_percent !== undefined) updateValues.customFeePercent = body.custom_fee_percent;
    }

    if (Object.keys(updateValues).length > 0) {
      db.update(items)
        .set(updateValues)
        .where(eq(items.id, itemId))
        .run();
    }

    return NextResponse.json({ ok: true, id: itemId });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Failed to update item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) {
    return NextResponse.json({ detail: "Invalid item ID" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .get();

  if (!existing) {
    return NextResponse.json({ detail: "Item not found" }, { status: 404 });
  }

  if (existing.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
  }

  db.delete(items).where(eq(items.id, itemId)).run();
  return NextResponse.json({ ok: true });
}
