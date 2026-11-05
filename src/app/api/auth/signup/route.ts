import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, users } from "@/lib/server/db";
import { createSession } from "@/lib/server/auth";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/server/passwords";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  const limit = rateLimit(`signup:${clientIp(request)}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");

    if (name.length < 2 || name.length > 40) {
      throw new PublicError("Username must be between 2 and 40 characters.");
    }
    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      throw new PublicError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    const existing = (
      await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.name}) = LOWER(${name})`)
    )[0];

    if (existing) {
      throw new PublicError("Username already taken.");
    }

    const parts = name.split(/\s+/).filter(Boolean);
    let initials = "??";
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }

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
          passwordHash: hashPassword(password),
          role: "friend",
          avatarInitials: initials,
          disabled: 0,
        })
        .returning({ id: users.id })
    )[0];

    const token = await createSession(inserted.id);
    const response = NextResponse.json({
      user: {
        id: inserted.id,
        name,
        role: "friend",
        avatar_initials: initials,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (err) {
    return errorResponse("signup", err);
  }
}
