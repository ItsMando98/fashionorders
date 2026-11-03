import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { db, ensureDb, scrapeSources } from "@/lib/server/db";
import { listScrapeSources, toScrapeSource } from "@/lib/server/seller-scraper";

// GET /api/admin/scrape-sources — alle konfigurierten Seller-Quellen (Admin).
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  try {
    const rows = await listScrapeSources();
    return NextResponse.json({ sources: rows.map(toScrapeSource) });
  } catch (err) {
    return errorResponse("scrape-sources-list", err);
  }
}

// POST /api/admin/scrape-sources — neue Seller-Quelle anlegen (Admin).
// Body: { seller_url, label?, interval_hours?, per_run_limit? }
export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const sellerUrl = String(body.seller_url || "").trim().replace(/\/$/, "");
    if (!/^https?:\/\/.+\..+/.test(sellerUrl)) {
      return NextResponse.json({ detail: "seller_url must be a valid URL" }, { status: 400 });
    }
    const intervalHours = Math.min(720, Math.max(1, Number(body.interval_hours) || 24));
    const perRunLimit = Math.min(200, Math.max(1, Number(body.per_run_limit) || 20));
    const label = String(body.label || "").trim().slice(0, 120);

    await ensureDb();
    try {
      const [row] = await db
        .insert(scrapeSources)
        .values({ sellerUrl, label, intervalHours, perRunLimit })
        .returning();
      return NextResponse.json({ source: toScrapeSource(row) }, { status: 201 });
    } catch (err) {
      // Unique-Verletzung: diese Seller-URL existiert bereits als Quelle
      if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
        return NextResponse.json({ detail: "This seller URL is already configured" }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    return errorResponse("scrape-sources-create", err);
  }
}
