import {
  optimizeImage,
  imageWidths,
  sizedObjectPath,
} from "./image-optimization";
import crypto from "node:crypto";
import { PublicError } from "../server/http";
import { fetchAllowed, readLimited } from "../server/scraper";
function config() {
  const url = process.env.SUPABASE_INTERNAL_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new PublicError("Medienablage ist noch nicht konfiguriert.", 503);
  return {
    url: url.replace(/\/$/, ""),
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}
export async function storageRequest(path: string, init: RequestInit = {}) {
  const c = config();
  const response = await fetch(`${c.url}/storage/v1${path}`, {
    ...init,
    headers: { ...c.headers, ...init.headers },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok)
    throw new PublicError("Medienablage nicht erreichbar.", 503);
  return response;
}
export async function uploadSourceImage(
  url: string,
  referer: string,
  bucket: string,
  key: string,
) {
  const response = await fetchAllowed(
    url,
    { "User-Agent": "Mozilla/5.0", Referer: referer },
    "image",
  );
  if (!response?.ok) throw new Error("Bild nicht verfügbar");
  const bytes = await readLimited(response, 64_000_000);
  if (!bytes) throw new Error("Bild zu groß");
  const type = detectImageType(
    bytes,
    response.headers.get("content-type")?.split(";")[0] || "",
  );
  if (!type) throw new Error("Bildformat nicht erlaubt");
  return uploadImageBytes(bytes, bucket, key);
}
/**
 * Decides the real image type. Some Yupoo sellers are served with "image/jpg" (not a
 * registered type) or no type at all, so the header alone is not reliable. The first bytes
 * of the file ("magic bytes") are, and they also keep non-images out.
 */
export function detectImageType(
  bytes: Uint8Array,
  header: string,
): "image/jpeg" | "image/png" | "image/webp" | "image/avif" | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  )
    return "image/png";
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return "image/webp";
  if (b.length >= 12 && ascii(4, 8) === "ftyp" && /avif|avis/.test(ascii(8, 12)))
    return "image/avif";
  // No known signature: only trust a clean header, never "text/html" and the like.
  const h = header.toLowerCase();
  return h === "image/jpeg" || h === "image/png" || h === "image/webp" || h === "image/avif"
    ? (h as "image/jpeg" | "image/png" | "image/webp" | "image/avif")
    : null;
}
/** Speichert bereits vorhandene Bildbytes (z. B. ein KI-Foto) als WebP in drei Größen. */
export async function uploadImageBytes(
  bytes: Buffer | Uint8Array,
  bucket: string,
  key: string,
) {
  const optimized = await optimizeImage(bytes);
  const digest = crypto
    .createHash("sha256")
    .update(optimized)
    .digest("hex")
    .slice(0, 20);
  const objectPath = `${key}/web-v1/${digest}.webp`;
  // Main asset first. Smaller responsive assets use the same immutable content identity.
  for (const width of [...imageWidths].reverse()) {
    const body =
      width === 1600 ? optimized : await optimizeImage(optimized, width);
    await storageRequest(
      `/object/${bucket}/${sizedObjectPath(objectPath, width)}`,
      {
        method: "POST",
        headers: { "Content-Type": "image/webp", "x-upsert": "true" },
        body: new Uint8Array(body),
      },
    );
  }
  return objectPath;
}
export async function signedMedia(bucket: string, path: string) {
  const r = await storageRequest(`/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  const data = await r.json();
  if (!data.signedURL) throw new PublicError("Bild nicht verfügbar.", 503);
  return data.signedURL as string;
}
