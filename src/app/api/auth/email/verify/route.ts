import crypto from "crypto";
import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { createSession } from "@/lib/server/auth";
import { db, loginCodes, users } from "@/lib/server/db";
import { initialsFromName, normalizeEmail } from "@/lib/server/email";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import {
  dummyVerify,
  hashPassword,
  verifyPassword,
} from "@/lib/server/passwords";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  const limit = rateLimit(
    `email-verify:${clientIp(request)}`,
    20,
    15 * 60 * 1000,
  );
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const purpose =
      body.purpose === "signup"
        ? "signup"
        : body.purpose === "login"
          ? "login"
          : "";
    const email = normalizeEmail(String(body.email || ""));
    const code = String(body.code || "").trim();

    if (!purpose || !email || !/^\d{6}$/.test(code)) {
      throw new PublicError("Enter the 6-digit code from your email.");
    }

    const row = (
      await db
        .select()
        .from(loginCodes)
        .where(
          and(eq(loginCodes.email, email), eq(loginCodes.purpose, purpose)),
        )
        .orderBy(desc(loginCodes.id))
    )[0];

    if (!row || Date.parse(row.expiresAt) <= Date.now() || row.attempts >= 5) {
      if (row) await db.delete(loginCodes).where(eq(loginCodes.id, row.id));
      dummyVerify(code);
      throw new PublicError(
        "That code is invalid or expired. Request a new one.",
        401,
      );
    }

    const checked = verifyPassword(row.codeHash, code);
    if (!checked.ok) {
      await db
        .update(loginCodes)
        .set({ attempts: row.attempts + 1 })
        .where(eq(loginCodes.id, row.id));
      throw new PublicError(
        "That code is invalid or expired. Request a new one.",
        401,
      );
    }

    await db.delete(loginCodes).where(eq(loginCodes.id, row.id));

    if (purpose === "login") {
      const user = (
        await db
          .select()
          .from(users)
          .where(sql`LOWER(${users.email}) = ${email}`)
      )[0];
      if (!user)
        throw new PublicError(
          "No account uses that email. Create one first.",
          401,
        );
      if (user.disabled === 1)
        throw new PublicError("This account is disabled.", 403);
      return sessionResponse({
        id: user.id,
        name: user.name,
        role: user.role as "admin" | "friend",
        avatar_initials: user.avatarInitials,
      });
    }

    const name = (row.name || "").trim();
    if (name.length < 2)
      throw new PublicError("Sign up again and enter your name.");

    const existing = (
      await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${email}`)
    )[0];
    if (existing)
      throw new PublicError(
        "That email already has an account. Sign in instead.",
      );

    const inserted = (
      await db
        .insert(users)
        .values({
          name,
          handle:
            (name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 30) || "user") +
            "-" +
            crypto.randomBytes(6).toString("hex"),
          email,
          passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
          role: "friend",
          avatarInitials: initialsFromName(name),
          disabled: 0,
        })
        .returning({ id: users.id, avatarInitials: users.avatarInitials })
    )[0];

    return sessionResponse({
      id: inserted.id,
      name,
      role: "friend",
      avatar_initials: inserted.avatarInitials,
    });
  } catch (err) {
    return errorResponse("email-verify", err);
  }
}

async function sessionResponse(user: {
  id: number;
  name: string;
  role: "admin" | "friend";
  avatar_initials: string;
}) {
  const token = await createSession(user.id);
  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
