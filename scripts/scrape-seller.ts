/**
 * Yupoo Seller -> Produktkatalog
 *
 * Liest die Album-Liste eines Yupoo-Sellers, scraped jedes Album und legt
 * es als Produkt im globalen Katalog an (Dedupe ueber source_url).
 *
 * Usage:
 *   node --import tsx scripts/scrape-seller.ts "https://happywhale.x.yupoo.com" [--limit=10]
 */
import { scrapeSellerAlbums } from "../src/lib/server/seller-scraper";

async function main() {
  const sellerArg = process.argv[2];
  if (!sellerArg) {
    console.error('Usage: node --import tsx scripts/scrape-seller.ts "https://SELLER.x.yupoo.com" [--limit=10]');
    process.exit(1);
  }
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 20;

  console.log(`Scraping albums from ${sellerArg} (limit ${limit}) ...`);
  const result = await scrapeSellerAlbums(sellerArg, limit);
  console.log(
    `Done: ${result.added} products added/updated, ${result.failed} failed (${result.total} albums).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
