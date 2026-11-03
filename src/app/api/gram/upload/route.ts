import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { CACHE_DIR } from "@/lib/server/gram";
import { errorResponse, PublicError, tooManyAttempts } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`gram-upload:${user.id}`, 30, 60 * 60 * 1000);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSec);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new PublicError("Pick a photo or video.");
    const ext = EXT_BY_MIME[file.type];
    if (!ext) throw new PublicError("Only JPEG, PNG, WebP, GIF, MP4, WebM or MOV files.");
    if (file.size <= 0 || file.size > MAX_BYTES) throw new PublicError("Files up to 50 MB only.");

    const mediaKind = file.type.startsWith("video/") ? "video" : "image";
    const filename = `${user.id}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, filename), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ ok: true, filename, media_kind: mediaKind });
  } catch (err) {
    return errorResponse("gram-upload", err);
  }
}
