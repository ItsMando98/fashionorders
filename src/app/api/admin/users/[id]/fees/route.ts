import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, users } from "@/lib/server/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const targetUserId = parseInt(id, 10);
  if (isNaN(targetUserId)) {
    return NextResponse.json({ detail: "Invalid user ID" }, { status: 400 });
  }

  const targetUser = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .get();

  if (!targetUser) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const updateValues: Record<string, any> = {};

    // Fixed fee
    if (body.reset_item_fixed) {
      updateValues.customItemFixedEur = null;
    } else if (body.custom_item_fixed_eur !== undefined) {
      updateValues.customItemFixedEur = Math.max(0, parseFloat(body.custom_item_fixed_eur) || 0);
    }

    // Item percent
    if (body.reset_item_percent) {
      updateValues.customItemPercent = null;
    } else if (body.custom_item_percent !== undefined) {
      updateValues.customItemPercent = Math.max(0, parseFloat(body.custom_item_percent) || 0);
    }

    // Haul percent
    if (body.reset_haul_percent) {
      updateValues.customHaulPercent = null;
    } else if (body.custom_haul_percent !== undefined) {
      updateValues.customHaulPercent = Math.max(0, parseFloat(body.custom_haul_percent) || 0);
    }

    if (Object.keys(updateValues).length > 0) {
      db.update(users)
        .set(updateValues)
        .where(eq(users.id, targetUserId))
        .run();
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Failed to update member fees" },
      { status: 500 }
    );
  }
}
