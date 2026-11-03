import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { activeStories, createStory } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    return NextResponse.json({ stories: await activeStories(user.id) });
  } catch (err) {
    return errorResponse("gram-stories", err);
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-story:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const story = await createStory(
      user.id,
      String(body.media || ""),
      String(body.media_kind || "image"),
      String(body.caption || "")
    );
    if (!story) throw new PublicError("Upload a photo or video first.");
    return NextResponse.json({ ok: true, ...story });
  } catch (err) {
    return errorResponse("gram-story", err);
  }
}
