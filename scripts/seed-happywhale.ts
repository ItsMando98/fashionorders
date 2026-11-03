import { scrapeAnyUrl } from "../src/lib/server/scraper";
import { ensureDb, getSql } from "../src/lib/server/db";
import { createLook, finishLook } from "../src/lib/server/gram";
import { dressModel } from "../src/lib/server/try-on";
import path from "path";
import fs from "fs";

async function main() {
const albums = [
  "https://happywhale.x.yupoo.com/albums/237312930?uid=1",
  "https://happywhale.x.yupoo.com/albums/259422922?uid=1",
  "https://happywhale.x.yupoo.com/albums/259878856?uid=1",
  "https://happywhale.x.yupoo.com/albums/213471915?uid=1",
  "https://happywhale.x.yupoo.com/albums/239772614?uid=1",
  "https://happywhale.x.yupoo.com/albums/239772612?uid=1",
];

await ensureDb();
const sql = getSql();
const userId = 1;

const saved: { id: number; title: string; local_image: string }[] = [];
for (const url of albums) {
  try {
    const product = await scrapeAnyUrl(url);
    const image = product.local_image.split("/").pop() || "";
    if (!image) {
      console.log("no image", url, product.title);
      continue;
    }
    const inserted = await sql<{ id: number }[]>`
      INSERT INTO items (
        user_id, url, title, brand, category, local_image, source_platform, price_cny,
        quantity, stage, order_status, is_shared
      )
      VALUES (${userId}, ${product.url}, ${product.title.slice(0, 300)}, ${product.brand || "Fashion"},
        ${product.category || "Apparel"}, ${image}, ${product.source_platform || "Yupoo"}, ${product.price_cny},
        1, 'submitted', 'Pending', 0)
      RETURNING id
    `;
    const id = inserted[0].id;
    await sql`
      INSERT INTO gram_posts (user_id, item_id, title, caption, image, published)
      VALUES (${userId}, ${id}, ${product.title.slice(0, 300)}, ${product.brand || ""}, ${image}, 1)
    `;
    saved.push({ id, title: product.title, local_image: product.local_image });
    console.log("saved", id, product.title, product.local_image);
  } catch (err) {
    console.log("skip", url, err instanceof Error ? err.message : err);
  }
}

await sql`
  UPDATE users SET bio = ${"Night drops from Happywhale. Jackets, shirts, shoes."}
  WHERE id = ${userId}
`;

const cache = path.resolve(".cache_images");
function filesFor(rows: { local_image: string }[]) {
  return rows
    .map((row) => path.join(cache, path.basename(row.local_image)))
    .filter((file) => fs.existsSync(file));
}

const outfits = [
  { title: "Orange planet coat", ids: saved.slice(0, 3) },
  { title: "Walk the neon", ids: saved.slice(3, 6) },
].filter((outfit) => outfit.ids.length > 0);

for (const outfit of outfits) {
  const created = await createLook(
    userId,
    outfit.title,
    outfit.ids.map((row) => row.id)
  );
  if (!created) continue;
  try {
    const filename = await dressModel(
      created.id,
      created.items.map((item) => item.title.slice(0, 120)),
      filesFor(created.items)
    );
    await finishLook(userId, created.id, filename, "ready");
    await sql`UPDATE gram_looks SET published = 1 WHERE id = ${created.id}`;
    console.log("look ready", created.id, filename);
  } catch (err) {
    await finishLook(userId, created.id, "", "failed");
    console.log("look failed", created.id, err instanceof Error ? err.message : err);
  }
}

console.log("done", saved.length, "products");
await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
