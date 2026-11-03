import { NextResponse } from "next/server";
import { ensureDb, getSql } from "@/lib/server/db";

export async function GET() {
  try {
    await ensureDb();
    await getSql()`SELECT 1 AS ok`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("health", err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
