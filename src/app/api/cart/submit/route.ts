import { enabled as commerceEnabled } from "@/lib/commerce/core";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, items } from "@/lib/server/db";

export async function POST(request: Request) {
  if (commerceEnabled()) return NextResponse.json({detail:"Bitte den neuen Shop-/Importablauf verwenden."},{status:409});
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const res = await db
    .update(items)
    .set({
      stage: "submitted",
      orderStatus: "To Order",
    })
    .where(and(eq(items.userId, user.id), eq(items.stage, "cart")));

  return NextResponse.json({
    ok: true,
    submitted_count: res.count,
    message: `Submitted ${res.count} items to the order queue.`,
  });
}
