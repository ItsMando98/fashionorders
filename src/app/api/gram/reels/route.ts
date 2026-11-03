import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { createReel, reelsFeed } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    return NextResponse.json({ reels: await reelsFeed(user.id) });
  } catch (err) {
    return errorResponse("gram-reels", err);
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-reel:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const reel = await createReel(user.id, String(body.video || ""), String(body.caption || ""));
    if (!reel) throw new PublicError("Upload a video first.");
    return NextResponse.json({ ok: true, ...reel });
  } catch (err) {
    return errorResponse("gram-reel", err);
  }
}
