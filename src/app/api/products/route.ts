import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { getFeeSettings } from "@/lib/server/pricing";
import { listProducts, scrapeToProduct, toAdminProduct, toPublicProduct } from "@/lib/server/products";
import { db, products } from "@/lib/server/db";

// GET /api/products?search=&category=&brand=&page=&page_size=
// Kunden bekommen PublicProduct (ohne Seller), Admins AdminProduct (mit Seller).
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const feeSettings = await getFeeSettings();
    const isAdmin = user.role === "admin";

    const { rows, total } = await listProducts({
      search: url.searchParams.get("search") || undefined,
      category: url.searchParams.get("category") || undefined,
      brand: url.searchParams.get("brand") || undefined,
      page: parseInt(url.searchParams.get("page") || "1", 10),
      pageSize: parseInt(url.searchParams.get("page_size") || "24", 10),
      includeInactive: isAdmin && url.searchParams.get("include_inactive") === "1",
    });

    const mapped = isAdmin
      ? rows.map((r) => toAdminProduct(r, feeSettings, user))
      : rows.map((r) => toPublicProduct(r, feeSettings, user));

    return NextResponse.json({ products: mapped, total, settings: { cny_to_eur: feeSettings.cny_to_eur } });
  } catch (err) {
    return errorResponse("products-list", err);
  }
}

// POST /api/products  (Admin)
// Body: { url } -> scrapen + anlegen, oder manuelle Felder.
export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (body.url) {
      const product = await scrapeToProduct(String(body.url), body.seller ? String(body.seller) : undefined);
      const feeSettings = await getFeeSettings();
      return NextResponse.json({ ok: true, product: toAdminProduct(product, feeSettings, user) });
    }

    // Manuelles Anlegen
    if (!body.title) {
      return NextResponse.json({ detail: "title or url is required" }, { status: 400 });
    }
    const inserted = (
      await db
        .insert(products)
        .values({
          title: String(body.title).slice(0, 300),
          brand: body.brand || "—",
          category: body.category || "Apparel / Item",
          availableSizes: body.available_sizes || "",
          description: String(body.description || "").slice(0, 5000),
          priceCny: body.price_cny !== undefined && body.price_cny !== null ? Number(body.price_cny) : null,
          localImage: body.local_image || "",
          sourcePlatform: body.source_platform || "Manual",
          seller: String(body.seller || "").slice(0, 120),
          sourceUrl: body.source_url || "",
          weidianUrl: body.weidian_url || "",
          active: 1,
        })
        .returning()
    )[0];

    const feeSettings = await getFeeSettings();
    return NextResponse.json({ ok: true, product: toAdminProduct(inserted, feeSettings, user) });
  } catch (err) {
    return errorResponse("products-create", err);
  }
}
