import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { normalizeEmail, sendInviteEmail } from "@/lib/server/email";
import { saveInvite } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-invite:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email || ""));
    if (!email) throw new PublicError("Enter a real email address.");
    const origin = new URL(request.url).origin;
    await saveInvite(user.id, email);
    await sendInviteEmail(email, user.name, `${origin}/`);
    return NextResponse.json({ ok: true, email });
  } catch (err) {
    return errorResponse("gram-invite", err);
  }
}
