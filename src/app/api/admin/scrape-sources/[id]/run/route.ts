import { enabled, database } from "@/lib/commerce/core";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { getScrapeSource } from "@/lib/server/seller-scraper";
import { triggerSourceRun } from "@/lib/server/scheduler";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/scrape-sources/[id]/run — "Run now": startet den Scrape
// sofort im Hintergrund (Admin). Status ist danach ueber GET .../scrape-sources
// sichtbar (last_status: running -> ok/error).
export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const sourceId = Number(id);
    if (!Number.isFinite(sourceId)) {
      return NextResponse.json({ detail: "Invalid id" }, { status: 400 });
    }
    const source = await getScrapeSource(sourceId);
    if (!source) return NextResponse.json({ detail: "Source not found" }, { status: 404 });

    if(enabled()) {
      const tx=database();
      await tx`INSERT INTO shop_jobs(user_id,kind,payload) VALUES(${user.id},'source',${JSON.stringify({source_id:sourceId,seller_url:source.sellerUrl,limit:source.perRunLimit})}::jsonb)`;
      return NextResponse.json({started:true},{status:202});
    }
    const started = triggerSourceRun(sourceId);
    if (!started) {
      return NextResponse.json({ detail: "This source is already running" }, { status: 409 });
    }
    return NextResponse.json({ started: true }, { status: 202 });
  } catch (err) {
    return errorResponse("scrape-sources-run", err);
  }
}
