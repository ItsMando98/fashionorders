import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { db, settings } from "@/lib/server/db";
import { getFeeSettings } from "@/lib/server/pricing";

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const upsertSetting = (key: string, val: string) => {
      db.insert(settings)
        .values({ key, value: val })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: val },
        })
        .run();
    };

    if (body.cny_to_eur !== undefined) {
      const val = parseFloat(body.cny_to_eur);
      if (val > 0.01 && val < 1.0) upsertSetting("cny_to_eur", String(val));
    }
    if (body.default_item_fixed_eur !== undefined) {
      const val = Math.max(0, parseFloat(body.default_item_fixed_eur) || 0);
      upsertSetting("default_item_fixed_eur", String(val));
    }
    if (body.default_item_percent !== undefined) {
      const val = Math.max(0, parseFloat(body.default_item_percent) || 0);
      upsertSetting("default_item_percent", String(val));
    }
    if (body.default_haul_percent !== undefined) {
      const val = Math.max(0, parseFloat(body.default_haul_percent) || 0);
      upsertSetting("default_haul_percent", String(val));
    }

    return NextResponse.json({
      ok: true,
      settings: getFeeSettings(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
