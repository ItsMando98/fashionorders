import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { CACHE_DIR, mediaAllowed } from "@/lib/server/gram";

function contentType(filename: string): string {
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".gif")) return "image/gif";
  if (filename.endsWith(".mp4")) return "video/mp4";
  if (filename.endsWith(".webm")) return "video/webm";
  if (filename.endsWith(".mov")) return "video/quicktime";
  return "image/png";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return new NextResponse("Sign in to view this media", { status: 401 });

  const { filename } = await params;
  const safe = path.basename(filename);
  if (!(await mediaAllowed(safe, user.id))) return new NextResponse("Not found", { status: 404 });

  const filepath = path.join(CACHE_DIR, safe);
  if (!fs.existsSync(filepath)) return new NextResponse("Not found", { status: 404 });

  const type = contentType(safe);
  const size = fs.statSync(filepath).size;
  const range = request.headers.get("range");

  // Video players request byte ranges; answer 206 Partial Content for them.
  if (range && type.startsWith("video/")) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start < size && start <= end) {
        const chunk = Buffer.alloc(end - start + 1);
        const fd = fs.openSync(filepath, "r");
        fs.readSync(fd, chunk, 0, chunk.length, start);
        fs.closeSync(fd);
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Content-Type": type,
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunk.length),
          },
        });
      }
    }
  }

  const fileBuffer = fs.readFileSync(filepath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
