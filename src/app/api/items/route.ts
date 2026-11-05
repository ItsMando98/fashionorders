import { enabled as commerceEnabled } from "@/lib/commerce/core";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { db, items } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";

export async function POST(request: Request) {
  if (commerceEnabled()) return NextResponse.json({detail:"Bitte den neuen Shop-/Importablauf verwenden."},{status:409});
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const cny =
      body.price_cny !== undefined && body.price_cny !== null
        ? Number(body.price_cny)
        : null;
    const stage = body.stage === "submitted" ? "submitted" : "cart";
    const status = stage === "submitted" ? "To Order" : "In Cart";

    const inserted = (
      await db
        .insert(items)
        .values({
        userId: user.id,
        url: body.url || body.album_url || "",
        weidianUrl: body.weidian_url || "",
        sourcePlatform: body.source_platform || "Yupoo",
        seller: body.seller || "",
        title: String(body.title || "Untitled Item").slice(0, 300),
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
        userNotes: String(body.user_notes || "").slice(0, 2000),
        adminNotes: "",
        trackingNumber: "",
        imageUrl: "",
        localImage: body.local_image || "",
        isShared: 0,
        })
        .returning({ id: items.id })
    )[0];

    return NextResponse.json({ id: inserted.id, ok: true });
  } catch (err) {
    return errorResponse("create-item", err);
  }
}
