import { enabled as commerceEnabled } from "@/lib/commerce/core";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { scrapeToProduct } from "@/lib/server/products";

// POST /api/scrape/bulk  (Admin)
// Scraped bis zu 20 Yupoo-/Weidian-URLs und legt sie als Produkte im
// globalen Katalog an (Dedupe ueber source_url). Der Kunde sieht davon
// nichts — Seller-Infos bleiben Admin-only.
export async function POST(request: Request) {
  if (commerceEnabled()) return NextResponse.json({detail:"Bitte den neuen Shop-/Importablauf verwenden."},{status:409});
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  const limit = rateLimit(`scrape-bulk:${user.id}`, 5, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const urls: string[] = Array.isArray(body.urls) ? body.urls : [];
    if (urls.length === 0) {
      return NextResponse.json({ detail: "urls array is required" }, { status: 400 });
    }
    const batch = urls.slice(0, 20);

    let added = 0;
    const results: { url: string; ok: boolean; product_id?: number; title?: string; error?: string }[] = [];
    for (const rawUrl of batch) {
      const u = String(rawUrl || "").trim();
      if (!u) continue;
      try {
        const product = await scrapeToProduct(u);
        added++;
        results.push({ url: u, ok: true, product_id: product.id, title: product.title });
      } catch (err) {
        results.push({
          url: u,
          ok: false,
          error: err instanceof Error ? err.message : "scrape failed",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Added ${added} of ${batch.length} products to the catalog.`,
      count: added,
      added,
      results,
    });
  } catch (err) {
    return errorResponse("scrape-bulk", err);
  }
}
