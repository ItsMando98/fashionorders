import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { db, items } from "@/lib/server/db";
import { getFeeSettings } from "@/lib/server/pricing";
import { scrapeAnyUrl } from "@/lib/server/scraper";

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const urls: string[] = Array.isArray(body.urls) ? body.urls : [];
    const stage = body.stage === "submitted" ? "submitted" : "cart";
    const status = stage === "submitted" ? "To Order" : "In Cart";

    const cleanUrls = urls.map((u) => u.trim()).filter((u) => u.length > 5);
    if (cleanUrls.length === 0) {
      return NextResponse.json({ detail: "No valid URLs provided" }, { status: 400 });
    }

    const feeSettings = getFeeSettings();
    let importedCount = 0;

    for (const url of cleanUrls) {
      try {
        const scraped = await scrapeAnyUrl(url, feeSettings.cny_to_eur);

        db.insert(items)
          .values({
            userId: user.id,
            url: scraped.url,
            weidianUrl: scraped.weidian_url || "",
            sourcePlatform: scraped.source_platform || "Yupoo",
            seller: "",
            title: scraped.title,
            brand: scraped.brand,
            category: scraped.category,
            availableSizes: scraped.available_sizes || "",
            chosenSize: "",
            colorVariant: "",
            quantity: 1,
            priceCny: scraped.price_cny ?? null,
            shippingCny: 0,
            stage,
            orderStatus: status,
            description: "",
            userNotes: "",
            adminNotes: "",
            trackingNumber: "",
            imageUrl: "",
            localImage: scraped.local_image || "",
            isShared: 1,
          })
          .run();

        importedCount++;
      } catch {
        // continue with next
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${importedCount} items`,
      count: importedCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Bulk import failed" },
      { status: 500 }
    );
  }
}
