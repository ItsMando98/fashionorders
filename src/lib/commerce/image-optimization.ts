import sharp from "sharp";
export const imageWidths = [240, 640, 1600] as const;
export function mediaWidth(raw: string | null): 240 | 640 | 1600 {
  const n = Number(raw);
  return n === 240 || n === 640 ? n : 1600;
}
/** Auto-orient, strip metadata, preserve aspect ratio, never upscale. */
export async function optimizeImage(bytes: Buffer | Uint8Array, width = 1600) {
  return sharp(bytes, { failOn: "error", limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}
export function sizedObjectPath(path: string, width: number) {
  return width === 1600 ? path : path.replace(/\.webp$/, `.${width}.webp`);
}
export async function spreadsheetImage(bytes: Buffer) {
  return sharp(bytes)
    .rotate()
    .resize({
      width: 320,
      height: 320,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}
