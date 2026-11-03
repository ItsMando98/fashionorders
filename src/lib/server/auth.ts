import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, users, sessions } from "./db";
import { User } from "@/lib/types";

export function hashPassword(pw: string): string {
  return crypto
    .createHash("sha256")
    .update(`fashionorders_salt_${pw}`)
    .digest("hex");
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  db.insert(sessions)
    .values({
      token,
      userId,
    })
    .run();
  return token;
}

export function deleteSession(token: string): void {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

export function getUserFromToken(token: string | null): User | null {
  if (!token) return null;
  const cleanToken = token.startsWith("Bearer ")
    ? token.slice(7).trim()
    : token.trim();
  if (!cleanToken) return null;

  const res = db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      avatar_initials: users.avatarInitials,
      share_all_friends: users.shareAllFriends,
      custom_item_fixed_eur: users.customItemFixedEur,
      custom_item_percent: users.customItemPercent,
      custom_haul_percent: users.customHaulPercent,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, cleanToken))
    .get();

  if (!res) return null;
  return {
    ...res,
    role: res.role as "admin" | "friend",
  };
}

export function getAuthUser(request: Request): User | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    const url = new URL(request.url);
    const tokenQuery = url.searchParams.get("token");
    if (tokenQuery) return getUserFromToken(tokenQuery);
    return null;
  }
  return getUserFromToken(authHeader);
}
