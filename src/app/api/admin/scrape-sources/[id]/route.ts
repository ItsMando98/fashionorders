import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { db, ensureDb, scrapeSources } from "@/lib/server/db";
import { toScrapeSource } from "@/lib/server/seller-scraper";

const nowUtc = () => new Date().toISOString().slice(0, 19).replace("T", " ");

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/scrape-sources/[id] — Quelle bearbeiten (Admin).
// Erlaubte Felder: label, seller_url, interval_hours, per_run_limit, active
export async function PATCH(request: Request, context: RouteContext) {
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
    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = { updatedAt: nowUtc() };

    if (body.label !== undefined) patch.label = String(body.label).trim().slice(0, 120);
    if (body.seller_url !== undefined) {
      const url = String(body.seller_url).trim().replace(/\/$/, "");
      if (!/^https?:\/\/.+\..+/.test(url)) {
        return NextResponse.json({ detail: "seller_url must be a valid URL" }, { status: 400 });
      }
      patch.sellerUrl = url;
    }
    if (body.interval_hours !== undefined) {
      patch.intervalHours = Math.min(720, Math.max(1, Number(body.interval_hours) || 24));
    }
    if (body.per_run_limit !== undefined) {
      patch.perRunLimit = Math.min(200, Math.max(1, Number(body.per_run_limit) || 20));
    }
    if (body.active !== undefined) patch.active = body.active ? 1 : 0;

    await ensureDb();
    const [row] = await db
      .update(scrapeSources)
      .set(patch)
      .where(eq(scrapeSources.id, sourceId))
      .returning();
    if (!row) return NextResponse.json({ detail: "Source not found" }, { status: 404 });
    return NextResponse.json({ source: toScrapeSource(row) });
  } catch (err) {
    return errorResponse("scrape-sources-update", err);
  }
}

// DELETE /api/admin/scrape-sources/[id] — Quelle entfernen (Admin).
// Die bereits gescrapten Produkte bleiben im Katalog erhalten.
export async function DELETE(request: Request, context: RouteContext) {
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
    await ensureDb();
    const [row] = await db
      .delete(scrapeSources)
      .where(eq(scrapeSources.id, sourceId))
      .returning();
    if (!row) return NextResponse.json({ detail: "Source not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("scrape-sources-delete", err);
  }
}
