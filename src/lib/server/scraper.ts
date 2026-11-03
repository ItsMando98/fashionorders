import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.resolve(process.cwd(), ".cache_images");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export function extractPriceFromText(text: string): number | null {
  if (!text) return null;
  const patterns = [
    /(?:[¥￥💰]\s*)(\d{2,5}(?:\.\d{1,2})?)(?:\b|\s|,|$)/i,
    /(?:Price|price|售价|价格)\s*[:：]?\s*[¥￥]?\s*(\d{2,5}(?:\.\d{1,2})?)/i,
    /\b(\d{2,4})\s*(?:CNY|RMB|yuan|元)\b/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > 0 && val < 50000) return val;
    }
  }
  return null;
}

export function detectBrandAndCategory(
  title: string,
  desc: string,
  url: string
): { brand: string; category: string } {
  const combined = `${title} ${desc} ${url}`.toLowerCase();

  let brand = "Fashion / Unbranded";
  const brands = [
    ["Chrome Hearts", "chrome hearts"],
    ["Balenciaga", "balenciaga"],
    ["Prada", "prada"],
    ["Louis Vuitton", "louis vuitton", "lv"],
    ["Gucci", "gucci"],
    ["Dior", "dior"],
    ["Arc'teryx", "arcteryx", "arc'teryx"],
    ["Rick Owens", "rick owens"],
    ["Nike", "nike"],
    ["Adidas", "adidas"],
    ["Maison Margiela", "margiela"],
    ["Stussy", "stussy"],
    ["Corteiz", "corteiz"],
    ["Moncler", "moncler"],
    ["Stone Island", "stone island"],
    ["Represent", "represent"],
    ["Bape", "bape", "a bathing ape"],
    ["Fear of God", "essentials", "fear of god"],
    ["Goyard", "goyard"],
    ["Cartier", "cartier"],
  ];
  for (const [bName, ...aliases] of brands) {
    if (aliases.some((a) => combined.includes(a))) {
      brand = bName;
      break;
    }
  }

  let category = "Apparel / Other";
  const cats = [
    ["Hoodie & Sweats", "hoodie", "sweatshirt", "crewneck", "pullover", "卫衣", "连帽"],
    ["T-Shirt", "tee", "t-shirt", "short sleeve", "短袖", "t恤"],
    ["Jacket & Outerwear", "jacket", "down", "puffer", "parka", "coat", "windbreaker", "外套", "羽绒服", "夹克"],
    ["Pants & Shorts", "pants", "jeans", "denim", "trousers", "sweatpants", "shorts", "裤", "短裤", "牛仔裤"],
    ["Footwear", "shoes", "sneakers", "boots", "loafers", "slides", "dunk", "jordan", "bapesta", "鞋"],
    ["Socks & Underwear", "socks", "boxers", "underwear", "袜"],
    ["Bags & Accessories", "bag", "backpack", "wallet", "belt", "hat", "cap", "beanie", "scarf", "包", "皮带", "帽子"],
    ["Jewelry", "ring", "necklace", "bracelet", "earring", "chain", "戒指", "项链", "手链"],
  ];
  for (const [catName, ...terms] of cats) {
    if (terms.some((t) => combined.includes(t))) {
      category = catName;
      break;
    }
  }

  return { brand, category };
}

export async function downloadAndCacheThumbnail(
  imgUrl: string,
  referer: string,
  cacheKey: string
): Promise<string> {
  if (!imgUrl || imgUrl.includes("logo1@558")) return "";
  if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl;

  const filename = `${cacheKey}.png`;
  const filepath = path.join(CACHE_DIR, filename);

  if (fs.existsSync(filepath)) {
    return `/images/${filename}`;
  }

  try {
    const res = await fetch(imgUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: referer,
      },
    });
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > 500) {
        fs.writeFileSync(filepath, Buffer.from(arrayBuffer));
        return `/images/${filename}`;
      }
    }
  } catch {
    // Ignore download failure
  }
  return "";
}

export async function fetchWeidianSku(url: string) {
  const m = url.match(/itemID=(\d+)/i) || url.match(/item\.html\?id=(\d+)/i);
  const itemId = m ? m[1] : "";
  if (!itemId) return null;

  try {
    const apiUrl = `https://weidian.com/item/get-item-detail?itemId=${itemId}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: "https://weidian.com/",
      },
    });
    if (res.ok) {
      const json = await res.json();
      const resData = json?.result || {};
      const price = parseFloat(resData.price) || null;
      const title = resData.itemTitle || "";
      const imgUrl = (resData.headImgs && resData.headImgs[0]) || "";
      const sizes = (resData.skuInfos || [])
        .map((s: any) => s.title || s.skuTitle)
        .filter(Boolean);

      return {
        itemId,
        title,
        priceCny: price,
        availableSizes: sizes.slice(0, 10).join(" | "),
        imgUrl,
      };
    }
  } catch {
    // Fall back to direct HTML parse
  }
  return null;
}

export async function scrapeAnyUrl(url: string, cnyToEur: number = 0.13) {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith("http")) cleanUrl = "https://" + cleanUrl;

  const parsed = new URL(cleanUrl);
  const host = parsed.hostname.toLowerCase();
  const urlHash = crypto.createHash("md5").update(cleanUrl).digest("hex").slice(0, 12);

  // 1. Direct Weidian URL
  if (host.includes("weidian.com")) {
    const wd = await fetchWeidianSku(cleanUrl);
    const title = wd?.title || `Weidian Item (${wd?.itemId || "Link"})`;
    const { brand, category } = detectBrandAndCategory(title, wd?.availableSizes || "", cleanUrl);
    let localImg = "";
    if (wd?.imgUrl) {
      localImg = await downloadAndCacheThumbnail(
        wd.imgUrl,
        "https://weidian.com/",
        `weidian_${wd.itemId || urlHash}`
      );
    }
    const cny = wd?.priceCny ?? null;
    return {
      url: cleanUrl,
      weidian_url: cleanUrl,
      source_platform: "Weidian",
      title,
      brand,
      category,
      available_sizes: wd?.availableSizes || "See Weidian SKU",
      price_cny: cny,
      price_eur: cny !== null ? parseFloat((cny * cnyToEur).toFixed(2)) : null,
      local_image: localImg,
      order_status: "Pending",
    };
  }

  // 2. Yupoo Album URL
  if (host.includes("yupoo.com")) {
    const albumMatch = cleanUrl.match(/albums\/(\d+)/i);
    const albumId = albumMatch ? albumMatch[1] : urlHash;

    try {
      const res = await fetch(cleanUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: `${parsed.protocol}//${parsed.host}/`,
        },
      });

      const html = await res.text();
      const $ = cheerio.load(html);

      const titleEl = $(".showalbumheader__gallerytitle");
      const subEl = $(".showalbumheader__gallerysubtitle");
      const ogImg = $('meta[property="og:image"]').attr("content") || "";

      const rawTitle = titleEl.text().trim();
      const rawSub = subEl.text().trim();

      // Look for embedded Weidian / Taobao links
      let weidianUrl = "";
      subEl.find("a[href]").each((_, a) => {
        let href = $(a).attr("href") || "";
        if (href.includes("external?url=")) {
          try {
            const ext = new URL(href).searchParams.get("url");
            if (ext) href = decodeURIComponent(ext);
          } catch {}
        }
        if (href.includes("weidian.com") || href.includes("taobao.com")) {
          weidianUrl = href;
        }
      });

      let price = extractPriceFromText(rawTitle) || extractPriceFromText(rawSub);
      let availSizes = "S, M, L, XL, XXL";

      if (weidianUrl && weidianUrl.includes("weidian.com")) {
        const wd = await fetchWeidianSku(weidianUrl);
        if (wd) {
          if (price === null && wd.priceCny !== null) price = wd.priceCny;
          if (wd.availableSizes) availSizes = wd.availableSizes;
        }
      }

      let localImg = "";
      if (ogImg) {
        localImg = await downloadAndCacheThumbnail(
          ogImg,
          `${parsed.protocol}//${parsed.host}/`,
          `yupoo_${albumId}`
        );
      }

      const { brand, category } = detectBrandAndCategory(rawTitle, rawSub, cleanUrl);
      const cleanTitle = rawTitle.replace(/^(?:[¥￥💰]\s*\d+[\s,]*|🏷️\s*)+/i, "").trim() || rawTitle || `Yupoo Album #${albumId}`;

      return {
        url: cleanUrl,
        weidian_url: weidianUrl || null,
        source_platform: "Yupoo",
        title: cleanTitle,
        brand,
        category,
        available_sizes: availSizes,
        price_cny: price,
        price_eur: price !== null ? parseFloat((price * cnyToEur).toFixed(2)) : null,
        local_image: localImg,
        order_status: "Pending",
      };
    } catch {
      // Fallback
      return {
        url: cleanUrl,
        weidian_url: null,
        source_platform: "Yupoo",
        title: `Yupoo Album #${albumId}`,
        brand: "Fashion / Unbranded",
        category: "Apparel / Other",
        available_sizes: "Standard Sizes",
        price_cny: null,
        price_eur: null,
        local_image: "",
        order_status: "Pending",
      };
    }
  }

  // Fallback for general links
  return {
    url: cleanUrl,
    weidian_url: null,
    source_platform: "Web",
    title: `Product Link (${parsed.hostname})`,
    brand: "Fashion / Unbranded",
    category: "Apparel / Other",
    available_sizes: "One Size",
    price_cny: null,
    price_eur: null,
    local_image: "",
    order_status: "Pending",
  };
}
