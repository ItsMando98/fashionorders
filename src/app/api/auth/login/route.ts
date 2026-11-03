import { NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/server/auth";
import { errorResponse, tooManyAttempts } from "@/lib/server/http";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  const limit = rateLimit(`login:${clientIp(request)}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");

    if (!name || !password) {
      return NextResponse.json(
        { detail: "Username and password required" },
        { status: 400 }
      );
    }

    const result = await authenticateUser(name, password);
    if (!result.ok) {
      return NextResponse.json({ detail: result.detail }, { status: result.status });
    }

    const token = await createSession(result.userId);
    const response = NextResponse.json({
      user: {
        id: result.userId,
        name: result.name,
        role: result.role,
        avatar_initials: result.avatar_initials,
        must_setup: result.must_setup,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (err) {
    return errorResponse("login", err);
  }
}
