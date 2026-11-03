import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { conversation, sendMessage, threadsFor } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    const withId = Number(new URL(request.url).searchParams.get("with") || 0);
    if (withId > 0) {
      return NextResponse.json({ messages: await conversation(user.id, withId) });
    }
    return NextResponse.json({ threads: await threadsFor(user.id) });
  } catch (err) {
    return errorResponse("gram-messages", err);
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-msg:${user.id}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const sent = await sendMessage(user.id, Number(body.to_user_id), String(body.body || ""));
    if (!sent) throw new PublicError("That user cannot receive this message.");
    return NextResponse.json({ ok: true, message: sent });
  } catch (err) {
    return errorResponse("gram-messages", err);
  }
}
