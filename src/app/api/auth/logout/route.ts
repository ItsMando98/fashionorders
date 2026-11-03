import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/server/auth";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    deleteSession(token);
  }
  return NextResponse.json({ ok: true });
}
