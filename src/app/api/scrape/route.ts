import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse, tooManyAttempts } from "@/lib/server/http";
import { getFeeSettings } from "@/lib/server/pricing";
import { rateLimit } from "@/lib/server/rate-limit";
import { scrapeAnyUrl } from "@/lib/server/scraper";

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const limit = rateLimit(`scrape:${user.id}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const body = await request.json();
    const url = (body.url || "").trim();
    if (!url) {
      return NextResponse.json({ detail: "URL is required" }, { status: 400 });
    }

    const settings = await getFeeSettings();
    const result = await scrapeAnyUrl(url, settings.cny_to_eur);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse("scrape", err);
  }
}
