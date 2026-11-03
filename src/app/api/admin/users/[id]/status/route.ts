import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { deleteUserSessions, getAuthUser } from "@/lib/server/auth";
import { db, users } from "@/lib/server/db";
import { errorResponse, PublicError } from "@/lib/server/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const targetUserId = parseInt(id, 10);
  if (isNaN(targetUserId)) {
    return NextResponse.json({ detail: "Invalid user ID" }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ detail: "You cannot disable your own account." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const disabled = body.disabled ? 1 : 0;
    const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)))[0];
    if (!target) throw new PublicError("User not found.", 404);

    await db.update(users).set({ disabled }).where(eq(users.id, targetUserId));
    if (disabled === 1) await deleteUserSessions(targetUserId);

    return NextResponse.json({ ok: true, disabled });
  } catch (err) {
    return errorResponse("account-status", err);
  }
}
