import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { toggleFollow } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-follow:${user.id}`, 60, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const targetId = Number(body.user_id);
    if (!Number.isInteger(targetId) || targetId <= 0) throw new PublicError("Pick a user.");
    const result = await toggleFollow(user.id, targetId);
    if (!result) throw new PublicError("You cannot follow that user.");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse("gram-follow", err);
  }
}
