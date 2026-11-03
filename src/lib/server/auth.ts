import crypto from "crypto";
import { eq, lt, sql } from "drizzle-orm";
import { db, ensureDb, users, sessions } from "./db";
import { User } from "@/lib/types";
import { dummyVerify, hashPassword, verifyPassword } from "./passwords";
import { readCookie, SESSION_COOKIE, sessionExpiresAt } from "./session-cookie";

const LOGIN_ERROR = "Incorrect username or password.";

export async function createSession(userId: number): Promise<string> {
  await ensureDb();
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.insert(sessions).values({
    token,
    userId,
    expiresAt: sessionExpiresAt(),
  });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await ensureDb();
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function deleteUserSessions(userId: number): Promise<void> {
  await ensureDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getUserFromToken(token: string | null): Promise<User | null> {
  if (!token) return null;
  const cleanToken = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
  if (!cleanToken) return null;
  await ensureDb();

  const res = (
    await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        avatar_initials: users.avatarInitials,
        share_all_friends: users.shareAllFriends,
        custom_item_fixed_eur: users.customItemFixedEur,
        custom_item_percent: users.customItemPercent,
        custom_haul_percent: users.customHaulPercent,
        disabled: users.disabled,
        expires_at: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.token, cleanToken))
  )[0];

  if (!res) return null;
  if (!res.expires_at || Date.parse(res.expires_at) <= Date.now() || res.disabled === 1) {
    await deleteSession(cleanToken);
    return null;
  }

  return {
    id: res.id,
    name: res.name,
    role: res.role as "admin" | "friend",
    avatar_initials: res.avatar_initials,
    share_all_friends: res.share_all_friends,
    custom_item_fixed_eur: res.custom_item_fixed_eur,
    custom_item_percent: res.custom_item_percent,
    custom_haul_percent: res.custom_haul_percent,
  };
}

export function getAuthUser(request: Request): Promise<User | null> {
  return getUserFromToken(readCookie(request, SESSION_COOKIE));
}

export async function authenticateUser(
  name: string,
  password: string
): Promise<
  | {
      ok: true;
      userId: number;
      name: string;
      role: "admin" | "friend";
      avatar_initials: string;
      must_setup: number;
    }
  | { ok: false; detail: string; status: number }
> {
  await ensureDb();
  const lookup = (
    await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.name}) = LOWER(${name})`)
  )[0];

  if (!lookup) {
    dummyVerify(password);
    return { ok: false, detail: LOGIN_ERROR, status: 401 };
  }

  const checked = verifyPassword(lookup.passwordHash, password);
  if (!checked.ok) {
    return { ok: false, detail: LOGIN_ERROR, status: 401 };
  }
  if (lookup.disabled === 1) {
    return { ok: false, detail: "This account is disabled.", status: 403 };
  }
  if (checked.needsUpgrade) {
    await db
      .update(users)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(users.id, lookup.id));
  }

  return {
    ok: true,
    userId: lookup.id,
    name: lookup.name,
    role: lookup.role as "admin" | "friend",
    avatar_initials: lookup.avatarInitials,
    must_setup: lookup.mustSetup,
  };
}
