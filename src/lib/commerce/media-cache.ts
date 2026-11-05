import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Row } from "./core";
import { storageRequest } from "./storage";
import { optimizeImage, sizedObjectPath } from "./image-optimization";
const pending = new Map<string, Promise<Buffer>>();
const root = () =>
  process.env.MEDIA_WEB_CACHE ||
  path.join(
    process.env.FASHION_ORDERS_CACHE || path.resolve(".cache_images"),
    "web",
  );
const digest = (m: Row, width: number) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(["web-v2", m.bucket, m.object_path, width]))
    .digest("hex");
/** Server-only cache. Callers must check ownership before reading or responding 304. */
export async function cachedMedia(m: Row, width: number): Promise<Buffer> {
  const key = digest(m, width),
    file = path.join(root(), key + ".webp");
  try {
    return await fs.readFile(file);
  } catch {}
  const existing = pending.get(key);
  if (existing) return existing;
  const operation = (async () => {
    let bytes: Buffer | undefined;
    if (
      m.bucket !== "legacy" &&
      m.object_path.includes("/web-v1/") &&
      m.object_path.endsWith(".webp")
    ) {
      try {
        bytes = Buffer.from(
          await (
            await storageRequest(
              `/object/${m.bucket}/${sizedObjectPath(m.object_path, width)}`,
            )
          ).arrayBuffer(),
        );
      } catch {}
    }
    if (!bytes) {
      const original =
        width === 1600
          ? undefined
          : await fs
              .readFile(path.join(root(), digest(m, 1600) + ".webp"))
              .catch(() => undefined);
      const source =
        original ||
        (m.bucket === "legacy"
          ? await fs.readFile(
              path.join(
                process.env.FASHION_ORDERS_CACHE ||
                  path.resolve(".cache_images"),
                path.basename(m.object_path),
              ),
            )
          : Buffer.from(
              await (
                await storageRequest(`/object/${m.bucket}/${m.object_path}`)
              ).arrayBuffer(),
            ));
      bytes = await optimizeImage(source, width);
    }
    await fs.mkdir(root(), { recursive: true, mode: 0o700 });
    const temp = file + "." + crypto.randomUUID() + ".tmp";
    await fs.writeFile(temp, bytes, { mode: 0o600 });
    await fs.rename(temp, file);
    return bytes;
  })();
  pending.set(key, operation);
  try {
    return await operation;
  } finally {
    pending.delete(key);
  }
}
export function mediaEtag(bytes: Buffer) {
  return '"' + crypto.createHash("sha256").update(bytes).digest("hex") + '"';
}
