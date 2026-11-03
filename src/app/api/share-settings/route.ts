import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, users, orderShares } from "@/lib/server/db";

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const shareAll = body.share_all ? 1 : 0;
    const targetUserIds: number[] = Array.isArray(body.target_user_ids)
      ? body.target_user_ids
      : [];

    db.update(users)
      .set({ shareAllFriends: shareAll })
      .where(eq(users.id, user.id))
      .run();

    // Refresh order_shares
    db.delete(orderShares).where(eq(orderShares.ownerId, user.id)).run();

    for (const tid of targetUserIds) {
      if (typeof tid === "number" && tid !== user.id) {
        db.insert(orderShares)
          .values({
            ownerId: user.id,
            sharedWithUserId: tid,
          })
          .run();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Failed to update sharing" },
      { status: 500 }
    );
  }
}
