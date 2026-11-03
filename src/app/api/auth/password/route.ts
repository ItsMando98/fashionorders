import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, users } from "@/lib/server/db";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "@/lib/server/passwords";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const limit = rateLimit(`password:${user.id}:${clientIp(request)}`, 8, 15 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const currentPassword = String(body.current_password || "");
    const nextPassword = String(body.new_password || "");

    if (nextPassword.length < MIN_PASSWORD_LENGTH || nextPassword.length > MAX_PASSWORD_LENGTH) {
      throw new PublicError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const row = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    if (!row || !verifyPassword(row.passwordHash, currentPassword).ok) {
      throw new PublicError("Current password is incorrect.", 401);
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(nextPassword) })
      .where(eq(users.id, user.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("password", err);
  }
}
