import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthUser } from "@/lib/server/auth";

const CACHE_DIR = process.env.FASHION_ORDERS_CACHE
  ? path.resolve(process.env.FASHION_ORDERS_CACHE)
  : path.resolve(process.cwd(), ".cache_images");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return new NextResponse("Not authenticated", { status: 401 });
  }

  const { filename } = await params;
  // Prevent directory traversal
  const safeFilename = path.basename(filename);
  const filepath = path.join(CACHE_DIR, safeFilename);

  if (!fs.existsSync(filepath)) {
    return new NextResponse("Image not found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filepath);
  let contentType = "image/png";
  if (safeFilename.endsWith(".jpg") || safeFilename.endsWith(".jpeg")) {
    contentType = "image/jpeg";
  } else if (safeFilename.endsWith(".webp")) {
    contentType = "image/webp";
  }

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
