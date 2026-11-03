import { NextResponse } from "next/server";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, users, orderShares } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const shareAll = body.share_all_friends ?? body.share_all ? 1 : 0;
    const rawIds = Array.isArray(body.shared_with_user_ids)
      ? body.shared_with_user_ids
      : Array.isArray(body.target_user_ids)
        ? body.target_user_ids
        : [];
    const targetUserIds = rawIds
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id !== user.id);

    await db
      .update(users)
      .set({ shareAllFriends: shareAll })
      .where(eq(users.id, user.id));

    // Refresh order_shares
    await db.delete(orderShares).where(eq(orderShares.ownerId, user.id));

    const allowed =
      targetUserIds.length === 0
        ? []
        : await db
            .select({ id: users.id })
            .from(users)
            .where(and(inArray(users.id, targetUserIds), ne(users.id, user.id), eq(users.disabled, 0)));

    for (const row of allowed) {
      await db
        .insert(orderShares)
        .values({
          ownerId: user.id,
          sharedWithUserId: row.id,
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("share-settings", err);
  }
}
