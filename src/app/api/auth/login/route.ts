import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, users } from "@/lib/server/db";
import { hashPassword, createSession } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const password = (body.password || "").trim();

    if (!name || !password) {
      return NextResponse.json(
        { detail: "Username and password required" },
        { status: 400 }
      );
    }

    const user = db
      .select()
      .from(users)
      .where(sql`LOWER(${users.name}) = LOWER(${name})`)
      .get();

    if (!user) {
      return NextResponse.json(
        { detail: "User not found. Check credentials or register." },
        { status: 401 }
      );
    }

    if (user.passwordHash !== hashPassword(password)) {
      return NextResponse.json(
        { detail: "Incorrect password or PIN." },
        { status: 401 }
      );
    }

    const token = createSession(user.id);
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar_initials: user.avatarInitials,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
