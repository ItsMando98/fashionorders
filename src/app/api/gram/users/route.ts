import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { searchUsers } from "@/lib/server/gram";
import { errorResponse, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-search:${user.id}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const q = new URL(request.url).searchParams.get("q") || "";
    return NextResponse.json({ users: await searchUsers(q, user.id) });
  } catch (err) {
    return errorResponse("gram-search", err);
  }
}
