/**
 * KI-Kategorisierung (Backend): analysiert Produktfotos mit Google Gemini
 * (Vision) und liefert Titel, Gender, Kategorie, Subkategorie, Brand, Farbe.
 *
 * Hinweis zur Modellwahl: "Embeddings" waeren fuer Aehnlichkeitssuche —
 * fuer Foto -> Kategorie ist ein Vision-LLM das richtige Werkzeug.
 * Genutzt wird `gemini-2.5-flash` (schnell, guenstig, bildfaehig) via
 * schlichter REST-API, kein zusaetzliches npm-Paket noetig.
 *
 * Aktivierung: GEMINI_API_KEY in der Umgebung (VPS: /opt/fashion-supply/.env).
 * Ohne Key gibt categorizeProductImage() null zurueck und Produkte bleiben
 * ai_status='pending' (nachholbar via scripts/categorize-products.ts).
 */

// Shop-Taxonomie (profi-Shop-Stil). Subkategorien je Hauptkategorie.
export const PRODUCT_TAXONOMY: Record<string, string[]> = {
  Tops: ["T-Shirt", "Shirt", "Hoodie", "Sweatshirt", "Sweater", "Polo", "Tank Top"],
  Bottoms: ["Pants", "Jeans", "Shorts", "Sweatpants", "Skirt"],
  Outerwear: ["Jacket", "Coat", "Puffer Jacket", "Vest", "Blazer"],
  Shoes: ["Sneakers", "Boots", "Loafers", "Sandals", "Slides"],
  Accessories: ["Cap", "Hat", "Belt", "Socks", "Sunglasses", "Jewelry", "Scarf", "Gloves", "Watch", "Other Accessory"],
  Bags: ["Backpack", "Shoulder Bag", "Tote Bag", "Wallet", "Crossbody Bag", "Duffel Bag"],
};

export const PRODUCT_GENDERS = ["men", "women", "unisex"] as const;

export interface AiCategorization {
  title: string;
  gender: string; // "men" | "women" | "unisex"
  category: string;
  subcategory: string;
  brand: string;
  color: string;
}

// Aktuelles Flash-Modell (2.5 ist fuer neue API-Keys nicht mehr verfuegbar)
const GEMINI_MODEL = "gemini-3.8-flash";
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

export function geminiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function buildPrompt(): string {
  const taxonomy = Object.entries(PRODUCT_TAXONOMY)
    .map(([cat, subs]) => `- ${cat}: ${subs.join(", ")}`)
    .join("\n");
  return [
    "You are categorizing a product photo for a professional fashion online shop.",
    "Look at the MAIN product in the image and answer with a single JSON object, no markdown:",
    '{"title": "...", "gender": "...", "category": "...", "subcategory": "...", "brand": "...", "color": "..."}',
    "",
    "Rules:",
    '- title: short product-style English name, max 8 words, e.g. "Washed Denim Jacket Blue". Include the brand if clearly visible.',
    '- gender: exactly one of "men", "women", "unisex". Use "unisex" when not clearly gendered.',
    "- category and subcategory: choose ONLY from this taxonomy:",
    taxonomy,
    "- brand: visible brand/logo name, or empty string.",
    '- color: dominant color(s), short, e.g. "black/white".',
    "If the image shows no fashion product (text screenshot, contact info, shipping notice),",
    'return {"title": "", "gender": "", "category": "", "subcategory": "", "brand": "", "color": ""}.',
  ].join("\n");
}

// Normalisiert die KI-Antwort gegen die Taxonomie (robust bei Abweichungen).
function normalize(raw: Record<string, unknown>): AiCategorization | null {
  const str = (v: unknown) => String(v ?? "").trim();
  const title = str(raw.title).slice(0, 120);
  if (!title) return null; // kein Produktfoto (Info-Bild etc.)

  let gender = str(raw.gender).toLowerCase();
  if (!(PRODUCT_GENDERS as readonly string[]).includes(gender)) gender = "unisex";

  let category = "";
  let subcategory = "";
  const rawCat = str(raw.category).toLowerCase();
  const rawSub = str(raw.subcategory).toLowerCase();
  for (const [cat, subs] of Object.entries(PRODUCT_TAXONOMY)) {
    if (cat.toLowerCase() === rawCat) {
      category = cat;
      subcategory = subs.find((s) => s.toLowerCase() === rawSub) || "";
      break;
    }
  }
  // Kategorie ggf. ueber die Subkategorie finden
  if (!category) {
    for (const [cat, subs] of Object.entries(PRODUCT_TAXONOMY)) {
      const hit = subs.find((s) => s.toLowerCase() === rawSub);
      if (hit) {
        category = cat;
        subcategory = hit;
        break;
      }
    }
  }

  return {
    title,
    gender,
    category,
    subcategory,
    brand: str(raw.brand).slice(0, 80),
    color: str(raw.color).slice(0, 60),
  };
}

// Laedt ein Foto und analysiert es mit Gemini. Gibt null zurueck bei:
// fehlendem API-Key, Download-Fehler, Kein-Produkt-Bild oder API-Fehler.
export async function categorizeProductImage(
  imageUrl: string,
  referer: string
): Promise<AiCategorization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !imageUrl) return null;

  // 1) Foto laden (Yupoo verlangt Referer + Browser-UA)
  let base64: string;
  try {
    const res = await fetch(imageUrl, {
      headers: { ...FETCH_HEADERS, Referer: referer },
    });
    if (!res.ok) return null;
    base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }

  // 2) Gemini Vision aufrufen (JSON-Antwort erzwungen)
  try {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: "image/jpeg", data: base64 } },
              { text: buildPrompt() },
            ],
          },
        ],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
      }),
    });
    if (!res.ok) {
      console.warn(`[categorize] Gemini HTTP ${res.status}:`, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const start = text.indexOf("{");
    if (start < 0) return null;
    return normalize(JSON.parse(text.slice(start)));
  } catch (err) {
    console.warn("[categorize] Gemini call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
