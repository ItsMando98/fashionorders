import { enabled as commerceEnabled, database as commerceDatabase } from "@/lib/commerce/core";
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
  if (commerceEnabled() && user.role !== 'admin') {
    const tx=commerceDatabase();
    const [allowed]=await tx`SELECT 1 WHERE EXISTS(SELECT 1 FROM shop_media m JOIN products p ON p.id=m.product_id WHERE m.bucket='legacy' AND m.object_path=${safeFilename} AND p.active=1 AND (p.owner_user_id=${user.id} OR p.visibility='catalog' AND p.publication='published')) OR EXISTS(SELECT 1 FROM items i WHERE (i.local_image=${'/images/'+safeFilename} OR i.local_image=${safeFilename}) AND (i.user_id=${user.id} OR EXISTS(SELECT 1 FROM gram_posts gp WHERE gp.item_id=i.id AND gp.published=1)))`;
    if(!allowed) return new NextResponse('Image not found',{status:404});
  }

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
      "Cache-Control": "private, no-store",
    },
  });
}
