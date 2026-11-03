import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, loginCodes, users } from "@/lib/server/db";
import { codeExpiresAt, createLoginCode, normalizeEmail, sendLoginCodeEmail } from "@/lib/server/email";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/passwords";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const ipLimit = rateLimit(`email-send:${clientIp(request)}`, 10, 60 * 60 * 1000);
  if (!ipLimit.ok) return tooManyAttempts(ipLimit.retryAfterSec);

  try {
    const body = await request.json();
    const purpose = body.purpose === "signup" ? "signup" : body.purpose === "login" ? "login" : "";
    const email = normalizeEmail(String(body.email || ""));
    const name = String(body.name || "").trim();

    if (!purpose) throw new PublicError("Choose sign in or sign up.");
    if (!email) throw new PublicError("Enter a valid email address.");

    const emailLimit = rateLimit(`email-send:${email}`, 5, 60 * 60 * 1000);
    if (!emailLimit.ok) return tooManyAttempts(emailLimit.retryAfterSec);

    if (purpose === "signup") {
      if (name.length < 2 || name.length > 40) {
        throw new PublicError("Name must be between 2 and 40 characters.");
      }
      const takenEmail = (
        await db
          .select({ id: users.id })
          .from(users)
          .where(sql`LOWER(${users.email}) = ${email}`)
      )[0];
      if (takenEmail) throw new PublicError("That email already has an account. Sign in instead.");
      const takenName = (
        await db
          .select({ id: users.id })
          .from(users)
          .where(sql`LOWER(${users.name}) = LOWER(${name})`)
      )[0];
      if (takenName) throw new PublicError("That name is already taken.");
    } else {
      const existing = (
        await db
          .select({ id: users.id, disabled: users.disabled })
          .from(users)
          .where(sql`LOWER(${users.email}) = ${email}`)
      )[0];
      if (!existing) throw new PublicError("No account uses that email. Create one first.");
      if (existing.disabled === 1) throw new PublicError("This account is disabled.", 403);
    }

    const code = createLoginCode();
    await db.delete(loginCodes).where(and(eq(loginCodes.email, email), eq(loginCodes.purpose, purpose)));
    await db
      .insert(loginCodes)
      .values({
        email,
        codeHash: hashPassword(code),
        purpose,
        name: purpose === "signup" ? name : null,
        expiresAt: codeExpiresAt(),
        attempts: 0,
      });

    try {
      await sendLoginCodeEmail(email, code);
    } catch (err) {
      await db.delete(loginCodes).where(and(eq(loginCodes.email, email), eq(loginCodes.purpose, purpose)));
      throw err;
    }

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    return errorResponse("email-send", err);
  }
}
