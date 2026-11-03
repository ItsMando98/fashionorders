import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { db, settings } from "@/lib/server/db";
import { getFeeSettings, getShopSettings } from "@/lib/server/pricing";

export async function POST(request: Request) {
  return handleSave(request);
}

// Die bestehende Admin-UI speichert per PATCH — beide Methoden erlauben.
export async function PATCH(request: Request) {
  return handleSave(request);
}

async function handleSave(request: Request) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const upsertSetting = async (key: string, val: string) => {
      await db
        .insert(settings)
        .values({ key, value: val })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: val },
        });
    };

    if (body.cny_to_eur !== undefined) {
      const val = parseFloat(body.cny_to_eur);
      if (val > 0.01 && val < 1.0) await upsertSetting("cny_to_eur", String(val));
    }
    if (body.default_item_fixed_eur !== undefined) {
      const val = Math.max(0, parseFloat(body.default_item_fixed_eur) || 0);
      await upsertSetting("default_item_fixed_eur", String(val));
    }
    if (body.default_item_percent !== undefined) {
      const val = Math.max(0, parseFloat(body.default_item_percent) || 0);
      await upsertSetting("default_item_percent", String(val));
    }
    if (body.default_haul_percent !== undefined) {
      const val = Math.max(0, parseFloat(body.default_haul_percent) || 0);
      await upsertSetting("default_haul_percent", String(val));
    }
    if (body.shipping_eur !== undefined) {
      const val = Math.max(0, parseFloat(body.shipping_eur) || 0);
      await upsertSetting("shipping_eur", String(val));
    }
    // Crypto-Wallet-Adressen fuer den manuellen Checkout (BTC/ETH/USDT)
    for (const key of ["crypto_btc_address", "crypto_eth_address", "crypto_usdt_address"] as const) {
      if (body[key] !== undefined) {
        await upsertSetting(key, String(body[key] || "").trim().slice(0, 200));
      }
    }

    return NextResponse.json({
      ok: true,
      settings: await getFeeSettings(),
      shop_settings: await getShopSettings(),
    });
  } catch (err) {
    console.error("admin-settings", err);
    return NextResponse.json(
      { detail: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
