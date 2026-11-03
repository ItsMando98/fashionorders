import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/server/auth";
import { readCookie, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await deleteSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
