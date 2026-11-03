import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { getFeeSettings } from "@/lib/server/pricing";
import { scrapeAnyUrl } from "@/lib/server/scraper";

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const url = (body.url || "").trim();
    if (!url) {
      return NextResponse.json({ detail: "URL is required" }, { status: 400 });
    }

    const settings = getFeeSettings();
    const result = await scrapeAnyUrl(url, settings.cny_to_eur);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Scraping failed" },
      { status: 500 }
    );
  }
}
