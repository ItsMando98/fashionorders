import { scrapeStructured } from "../src/lib/commerce/imports";
async function main() {
  const t = Date.now();
  try {
    const r = await scrapeStructured(process.argv[2]);
    console.log(JSON.stringify({ ms: Date.now() - t, url: r.url, title: r.title, n_images: r.images.length, images: r.images.slice(0, 12), sizes: r.variant_hints.sizes, colors: r.variant_hints.colors, links: r.procurement_links, price: r.price_cny, warnings: r.warnings }, null, 1));
  } catch (e) { console.log("FEHLER:", e instanceof Error ? e.message : e); }
  process.exit(0);
}
main();
