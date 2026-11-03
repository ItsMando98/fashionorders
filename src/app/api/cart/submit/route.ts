import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, items } from "@/lib/server/db";

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const res = db
    .update(items)
    .set({
      stage: "submitted",
      orderStatus: "To Order",
    })
    .where(and(eq(items.userId, user.id), eq(items.stage, "cart")))
    .run();

  return NextResponse.json({
    ok: true,
    submitted_count: res.changes,
    message: `Submitted ${res.changes} items to Mathis's order queue.`,
  });
}
