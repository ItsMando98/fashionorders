import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { CACHE_DIR, createLook, finishLook, setLookVisible } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { dressModel } from "@/lib/server/try-on";

export const maxDuration = 180;

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    const body = await request.json();
    if (body.look_id) {
      const ok = await setLookVisible(user.id, Number(body.look_id), Boolean(body.published));
      if (!ok) throw new PublicError("That look is not ready to show yet.", 400);
      return NextResponse.json({ ok: true });
    }

    const limit = rateLimit(`gram-look:${user.id}`, 4, 60 * 60 * 1000);
    if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

    const itemIds = Array.isArray(body.item_ids) ? body.item_ids.map(Number).filter((id: number) => id > 0) : [];
    const created = await createLook(user.id, String(body.title || "Look"), itemIds);
    if (!created) throw new PublicError("Pick one to four of your own products.");

    try {
      const files = created.items
        .map((item) => (item.local_image ? path.join(CACHE_DIR, path.basename(item.local_image)) : ""))
        .filter((file) => file && fs.existsSync(file));
      const filename = await dressModel(
        created.id,
        created.items.map((item) => item.title.slice(0, 120)),
        files
      );
      await finishLook(user.id, created.id, filename, "ready");
      return NextResponse.json({ ok: true, id: created.id, image: filename });
    } catch (err) {
      await finishLook(user.id, created.id, "", "failed");
      throw err;
    }
  } catch (err) {
    return errorResponse("gram-look", err);
  }
}
