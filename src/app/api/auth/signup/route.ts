import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, users } from "@/lib/server/db";
import { hashPassword, createSession } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const password = (body.password || "").trim();

    if (name.length < 2) {
      return NextResponse.json(
        { detail: "Username must be at least 2 characters." },
        { status: 400 }
      );
    }
    if (password.length < 3) {
      return NextResponse.json(
        { detail: "Password must be at least 3 characters." },
        { status: 400 }
      );
    }

    const existing = db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.name}) = LOWER(${name})`)
      .get();

    if (existing) {
      return NextResponse.json(
        { detail: "Username already taken." },
        { status: 400 }
      );
    }

    const parts = name.split(/\s+/).filter(Boolean);
    let initials = "??";
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }

    const role = name.toLowerCase() === "mathis" ? "admin" : "friend";
    const pwHash = hashPassword(password);

    const inserted = db
      .insert(users)
      .values({
        name,
        passwordHash: pwHash,
        role,
        avatarInitials: initials,
      })
      .returning({ id: users.id })
      .get();

    const userId = inserted.id;
    const token = createSession(userId);

    return NextResponse.json({
      token,
      user: {
        id: userId,
        name,
        role,
        avatar_initials: initials,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Signup failed" },
      { status: 500 }
    );
  }
}
