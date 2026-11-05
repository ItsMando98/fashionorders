import postgres from "postgres";
import fs from "node:fs";
import { hashPassword } from "../src/lib/server/passwords";
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (
    !url ||
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.startsWith("/fashion_shop_test")
  )
    throw new Error("Dedicated local test database required.");
  const sql = postgres(url, { max: 1 });
  try {
    const password = hashPassword(
      process.env.DEMO_PASSWORD || "local-demo-password",
    );
    await sql`INSERT INTO users(name,password_hash,role) VALUES('Browser Demo',${password},'friend'),('Browser Admin',${password},'admin') ON CONFLICT(name) DO UPDATE SET password_hash=excluded.password_hash`;
    const files = fs
      .readdirSync(".cache_images")
      .filter((f) => /\.(png|jpg|jpeg|webp)$/.test(f))
      .slice(0, 3);
    const [p] =
      await sql`SELECT id FROM products WHERE visibility='catalog' ORDER BY id LIMIT 1`;
    if (p) {
      for (const [index, file] of files.entries())
        await sql`INSERT INTO shop_media(product_id,bucket,object_path,alt,position) VALUES(${p.id},'legacy',${file},${"Produktansicht " + (index + 1)},${index}) ON CONFLICT DO NOTHING`;
      await sql`UPDATE products SET title='Essential Hoodie — Black',brand='Fashion Supply',description='Klarer Look, vielseitig kombinierbar. Größe und Lieferbarkeit werden vor deinem Angebot geprüft.',publication='published' WHERE id=${p.id}`;
      await sql`INSERT INTO shop_product_categories(product_id,category_id) VALUES(${p.id},'hoodies') ON CONFLICT DO NOTHING`;
    }
    console.log("Local browser fixtures ready.");
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
