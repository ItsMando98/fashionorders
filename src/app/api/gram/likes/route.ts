import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { TargetKind, toggleLike } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

const KINDS: TargetKind[] = ["post", "look", "reel"];

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-like:${user.id}`, 120, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const kind = String(body.target_kind || "") as TargetKind;
    const targetId = Number(body.target_id);
    if (!KINDS.includes(kind) || !Number.isInteger(targetId) || targetId <= 0) {
      throw new PublicError("Pick a post, look or reel.");
    }
    const result = await toggleLike(user.id, kind, targetId);
    if (!result) throw new PublicError("That post is not available.", 404);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse("gram-like", err);
  }
}
