import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { deleteUserSessions, getPendingSetupUser, createSession } from "@/lib/server/auth";
import { db, loginCodes, users } from "@/lib/server/db";
import { normalizeEmail } from "@/lib/server/email";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import {
  dummyVerify,
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "@/lib/server/passwords";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";

const PURPOSE = "setup";

// Step 2 of the forced first-login setup: verify the email code and set a
// new personal password. On success the must_setup flag is cleared.
export async function POST(request: Request) {
  const user = await getPendingSetupUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const limit = rateLimit(`setup-complete:${user.id}:${clientIp(request)}`, 12, 15 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email || ""));
    const code = String(body.code || "").trim();
    const nextPassword = String(body.new_password || "");

    if (!email || !/^\d{6}$/.test(code)) {
      throw new PublicError("Enter the 6-digit code from your email.");
    }
    if (nextPassword.length < MIN_PASSWORD_LENGTH || nextPassword.length > MAX_PASSWORD_LENGTH) {
      throw new PublicError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const row = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    if (!row) throw new PublicError("Account not found.", 404);
    if (row.mustSetup !== 1) throw new PublicError("Setup is already complete.");

    const taken = (
      await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${email}`)
    )[0];
    if (taken && taken.id !== user.id) {
      throw new PublicError("That email is already used by another account.");
    }

    const codeRow = (
      await db
        .select()
        .from(loginCodes)
        .where(and(eq(loginCodes.email, email), eq(loginCodes.purpose, PURPOSE)))
        .orderBy(desc(loginCodes.id))
    )[0];

    if (!codeRow || Date.parse(codeRow.expiresAt) <= Date.now() || codeRow.attempts >= 5) {
      if (codeRow) await db.delete(loginCodes).where(eq(loginCodes.id, codeRow.id));
      dummyVerify(code);
      throw new PublicError("That code is invalid or expired. Request a new one.", 401);
    }

    const checked = verifyPassword(codeRow.codeHash, code);
    if (!checked.ok) {
      await db
        .update(loginCodes)
        .set({ attempts: codeRow.attempts + 1 })
        .where(eq(loginCodes.id, codeRow.id));
      throw new PublicError("That code is invalid or expired. Request a new one.", 401);
    }

    await db.delete(loginCodes).where(eq(loginCodes.id, codeRow.id));

    await db
      .update(users)
      .set({ email, passwordHash: hashPassword(nextPassword), mustSetup: 0 })
      .where(eq(users.id, user.id));

    // Rotate the session so the temp-password session is replaced.
    await deleteUserSessions(user.id);
    const token = await createSession(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar_initials: user.avatar_initials,
        must_setup: 0,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (err) {
    return errorResponse("setup-complete", err);
  }
}
