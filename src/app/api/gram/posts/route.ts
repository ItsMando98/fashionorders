import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { setBio, setItemVisible } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-post:${user.id}`, 40, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    if (typeof body.bio === "string") {
      await setBio(user.id, body.bio);
      return NextResponse.json({ ok: true });
    }
    const itemId = Number(body.item_id);
    if (!Number.isInteger(itemId) || itemId <= 0) throw new PublicError("Pick a product.");
    const id = await setItemVisible(user.id, itemId, Boolean(body.published), String(body.caption || ""));
    if (!id) throw new PublicError("That product is not yours.", 404);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return errorResponse("gram-post", err);
  }
}
