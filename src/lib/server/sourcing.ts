import * as cheerio from "cheerio";

export function isYupooList(url: URL): boolean {
  return (
    url.hostname.endsWith(".yupoo.com") &&
    /^\/(?:collections|categories)\/\d+\/?$/.test(url.pathname)
  );
}

/** Only concrete marketplace items; no contact, shop-home or arbitrary redirect URLs. */
export function procurementUrl(raw: string, base?: string): string | null {
  try {
    let u = new URL(raw.trim().replace(/&amp;/g, "&"), base);
    if (u.hostname.endsWith(".yupoo.com") && /\/external$/.test(u.pathname)) {
      u = new URL(u.searchParams.get("url") || "");
    }
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.port
    )
      return null;
    const h = u.hostname.toLowerCase();
    const id = u.searchParams.get("id");
    if (
      ["item.taobao.com", "item.m.taobao.com"].includes(h) &&
      /^\/item\.htm[l]?$/.test(u.pathname) &&
      id &&
      /^\d+$/.test(id)
    )
      return `https://item.taobao.com/item.htm?id=${id}`;
    const wid = u.searchParams.get("itemID");
    if (
      ["weidian.com", "www.weidian.com"].includes(h) &&
      u.pathname === "/item.html" &&
      wid &&
      /^\d+$/.test(wid)
    )
      return `https://weidian.com/item.html?itemID=${wid}`;
  } catch {}
  return null;
}

export function extractProcurementLinks(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const section = $(".showalbumheader__gallerysubtitle");
  const links = new Set<string>();
  const add = (raw: string) => {
    const link = procurementUrl(raw, base);
    if (link) links.add(link);
  };
  section.find("a[href]").each((_, a) => add($(a).attr("href") || ""));
  const text =
    section.text() +
    "\n" +
    ($('meta[property="og:description"]').attr("content") || "");
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'，。]+/g))
    add(match[0]);
  return [...links];
}

const SIZE_TOKEN =
  /^(?:\d{1,3}(?:\.5)?|[2-6]?X{0,3}[SML]|XXL|XXXL|ONE[- ]?SIZE)$/i;

/** "46-54" -> 46,48,...,54 (jacket sizes) or 28..36 (trousers). Never invents huge lists. */
function expandSizeRange(from: number, to: number): string[] {
  if (!(to > from)) return [String(from)];
  const step = from >= 40 && from % 2 === 0 && to % 2 === 0 ? 2 : 1;
  const out: string[] = [];
  for (let n = from; n <= to && out.length < 14; n += step) out.push(String(n));
  return out;
}

function parseSizes(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(/[\s,，/、]+/)) {
    const range = part.match(/^(\d{1,3})\s*[-–~]\s*(\d{1,3})$/);
    if (range) out.push(...expandSizeRange(Number(range[1]), Number(range[2])));
    else if (SIZE_TOKEN.test(part)) out.push(part);
  }
  return [...new Set(out)];
}

const COLOUR_MODIFIER =
  /^(?:dark|light|deep|pale|bright|hot|baby|sky|navy|army|off|royal|neon|dusty|burnt)$/i;

function parseColours(raw: string): string[] {
  // Remove side notes like "(other colors can be customized)".
  const text = raw.replace(/[(（][^)）]*[)）]/g, " ");
  const out: string[] = [];
  for (const chunk of text.split(/[,，/、;；]+|\s+(?:and|&)\s+/i)) {
    const words = chunk.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      // Keep "dark green" together, split "black white khaki" apart.
      if (COLOUR_MODIFIER.test(words[i]) && words[i + 1]) {
        out.push(`${words[i]} ${words[i + 1]}`);
        i++;
      } else out.push(words[i]);
    }
  }
  return [
    ...new Set(
      out.filter((s) => s && s.length < 40 && !s.includes(":")),
    ),
  ];
}

export function variantHints(text: string) {
  // The colon is optional: many sellers write "Sizes 46-54".
  let sizes: string[] = [];
  for (const m of text.matchAll(/(?:尺码|尺寸|sizes?)\s*[:：]?\s*([^\n]+)/gi)) {
    sizes = parseSizes(m[1]);
    if (sizes.length) break;
  }
  const colors =
    text.match(/(?:颜色|colou?rs?)\s*[:：]\s*([^\n]+)/i)?.[1] || "";
  return { sizes, colors: parseColours(colors) };
}

/** Yupoo renditions share a photo folder; prefer the original over medium/small thumbnails. */
export function uniqueProductImages(urls: string[]): string[] {
  const images = new Map<string, string>();
  const thumbnail = (value: string) =>
    /\/(?:medium|small|square|big|thumb)\.[^/]+$/i.test(
      new URL(value).pathname,
    );
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      const folder =
        url.hostname === "photo.yupoo.com" &&
        /^\/[^/]+\/[a-f0-9]{6,}\/[^/]+$/i.test(url.pathname);
      const key = folder
        ? url.origin + url.pathname.slice(0, url.pathname.lastIndexOf("/"))
        : raw;
      const previous = images.get(key);
      if (!previous || (thumbnail(previous) && !thumbnail(raw)))
        images.set(key, raw);
    } catch {}
  }
  return [...images.values()];
}
