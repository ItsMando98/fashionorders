import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, loginCodes, users } from "@/lib/server/db";
import { codeExpiresAt, createLoginCode, normalizeEmail, sendLoginCodeEmail } from "@/lib/server/email";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/passwords";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

const PURPOSE = "setup";

// Step 1 of the forced first-login setup: the user enters their email,
// we send a 6-digit verification code to it.
export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const ipLimit = rateLimit(`setup-email:${clientIp(request)}`, 10, 60 * 60 * 1000);
  if (!ipLimit.ok) return tooManyAttempts(ipLimit.retryAfterSec);

  try {
    const row = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    if (!row) throw new PublicError("Account not found.", 404);
    if (row.mustSetup !== 1) throw new PublicError("Setup is already complete.");

    const email = normalizeEmail(String((await request.json()).email || ""));
    if (!email) throw new PublicError("Enter a valid email address.");

    const emailLimit = rateLimit(`setup-email:${email}`, 5, 60 * 60 * 1000);
    if (!emailLimit.ok) return tooManyAttempts(emailLimit.retryAfterSec);

    const taken = (
      await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${email}`)
    )[0];
    if (taken && taken.id !== user.id) {
      throw new PublicError("That email is already used by another account.");
    }

    const code = createLoginCode();
    await db.delete(loginCodes).where(and(eq(loginCodes.email, email), eq(loginCodes.purpose, PURPOSE)));
    await db.insert(loginCodes).values({
      email,
      codeHash: hashPassword(code),
      purpose: PURPOSE,
      name: null,
      expiresAt: codeExpiresAt(),
      attempts: 0,
    });

    try {
      await sendLoginCodeEmail(email, code);
    } catch (err) {
      await db.delete(loginCodes).where(and(eq(loginCodes.email, email), eq(loginCodes.purpose, PURPOSE)));
      throw err;
    }

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    return errorResponse("setup-email", err);
  }
}
