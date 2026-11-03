import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, users } from "@/lib/server/db";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const limit = rateLimit(`lookup:${user.id}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (name.length < 2) throw new PublicError("Enter the exact username.");

    const found = (
      await db
        .select({
          id: users.id,
          name: users.name,
          avatar_initials: users.avatarInitials,
          role: users.role,
        })
        .from(users)
        .where(sql`LOWER(${users.name}) = LOWER(${name}) AND ${users.disabled} = 0`)
    )[0];

    if (!found || found.id === user.id) {
      throw new PublicError("No account with that username.", 404);
    }

    return NextResponse.json({
      user: {
        id: found.id,
        name: found.name,
        avatar_initials: found.avatar_initials,
        role: found.role,
      },
    });
  } catch (err) {
    return errorResponse("user-lookup", err);
  }
}
