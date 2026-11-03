import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { db, items } from "@/lib/server/db";
import { getFeeSettings } from "@/lib/server/pricing";

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const feeSettings = getFeeSettings();
    const cny =
      body.price_cny !== undefined && body.price_cny !== null
        ? Number(body.price_cny)
        : null;
    const stage = body.stage === "submitted" ? "submitted" : "cart";
    const status = stage === "submitted" ? "To Order" : "In Cart";

    const inserted = db
      .insert(items)
      .values({
        userId: user.id,
        url: body.url || body.album_url || "",
        weidianUrl: body.weidian_url || "",
        sourcePlatform: body.source_platform || "Yupoo",
        seller: body.seller || "",
        title: body.title || "Untitled Item",
        brand: body.brand || "—",
        category: body.category || "Apparel / Item",
        availableSizes: body.available_sizes || "",
        chosenSize: body.chosen_size || "",
        colorVariant: body.color_variant || "",
        quantity: body.quantity ? Math.max(1, Number(body.quantity)) : 1,
        priceCny: cny,
        shippingCny: 0,
        stage: stage,
        orderStatus: status,
        description: body.description || "",
        userNotes: body.user_notes || "",
        adminNotes: "",
        trackingNumber: "",
        imageUrl: "",
        localImage: body.local_image || "",
        isShared: 1,
      })
      .returning({ id: items.id })
      .get();

    return NextResponse.json({ id: inserted.id, ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Failed to create item" },
      { status: 500 }
    );
  }
}
