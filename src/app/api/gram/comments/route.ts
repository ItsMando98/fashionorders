import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { addComment, commentsFor, TargetKind } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

const KINDS: TargetKind[] = ["post", "look", "reel"];

function parseTarget(request: Request) {
  const url = new URL(request.url);
  const kind = String(url.searchParams.get("kind") || "") as TargetKind;
  const targetId = Number(url.searchParams.get("id") || 0);
  if (!KINDS.includes(kind) || !Number.isInteger(targetId) || targetId <= 0) return null;
  return { kind, targetId };
}

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    const target = parseTarget(request);
    if (!target) throw new PublicError("Pick a post, look or reel.");
    const comments = await commentsFor(target.kind, target.targetId, user.id);
    if (!comments) return NextResponse.json({ detail: "That post is not available." }, { status: 404 });
    return NextResponse.json({ comments });
  } catch (err) {
    return errorResponse("gram-comments", err);
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-comment:${user.id}`, 60, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const kind = String(body.target_kind || "") as TargetKind;
    const targetId = Number(body.target_id);
    if (!KINDS.includes(kind) || !Number.isInteger(targetId) || targetId <= 0) {
      throw new PublicError("Pick a post, look or reel.");
    }
    const comment = await addComment(user.id, kind, targetId, String(body.body || ""));
    if (!comment) throw new PublicError("That post is not available.", 404);
    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    return errorResponse("gram-comment", err);
  }
}
