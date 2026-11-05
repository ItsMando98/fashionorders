/**
 * Prompt-Vorlagen für KI-Model-Fotos (Bildgenerierung).
 *
 * Dieses Modul enthält nur Text und reine Funktionen. Dadurch kann es
 * sowohl vom Server (Backend) als auch vom Admin-Assistenten (Frontend)
 * importiert werden.
 *
 * Platzhalter in den Vorlagen:
 *   {garment}  Beschreibung des Kleidungsstücks, z. B. "oversized black t-shirt with a white bird print"
 *   {color}    Farbe, z. B. "black"
 *   {fit}      Passform, z. B. "relaxed fit"
 *   {extra}    Freitext des Admins, z. B. "wearing light blue jeans"
 *
 * Die Prompts sind absichtlich Englisch, weil Bildmodelle damit am besten arbeiten.
 */

export type ModelTemplateGroup =
  | "Studio"
  | "Street"
  | "Lifestyle"
  | "Editorial"
  | "Produkt";

export type AspectRatio = "3:4" | "4:5" | "1:1" | "9:16" | "16:9";

export type ModelTemplate = {
  id: string;
  label: string;
  group: ModelTemplateGroup;
  gender: "men" | "women" | "unisex";
  /** Kurzbeschreibung für die Auswahlkarte (Deutsch). */
  summary: string;
  aspect: AspectRatio;
  prompt: string;
};

export const ASPECT_RATIOS: AspectRatio[] = ["3:4", "4:5", "1:1", "9:16", "16:9"];

/**
 * Wird serverseitig IMMER an jeden Prompt angehängt. Das schützt vor dem
 * häufigsten Fehler: Die KI "erfindet" ein anderes Kleidungsstück.
 */
export const GARMENT_RULES = [
  "IMPORTANT RULES:",
  "The attached reference photo(s) show the exact product to be sold.",
  "Reproduce this product faithfully: identical color, fabric look, cut, silhouette, print, embroidery, logo placement, buttons, seams and proportions.",
  "Do not redesign, recolor, simplify or add anything to the product.",
  "If a reference photo shows a person, ignore that person's identity and copy only the product.",
  "Do not add any text, captions, watermarks, labels or extra logos anywhere in the image.",
  "Natural human anatomy with correct hands and fingers, realistic skin texture, realistic fabric folds.",
  "Photorealistic, sharp, high resolution, suitable for an online fashion shop.",
].join(" ");

export const MODEL_TEMPLATES: ModelTemplate[] = [
  // ---------------------------------------------------------------- Studio
  {
    id: "men-studio-grey",
    label: "Herren · Studio hellgrau",
    group: "Studio",
    gender: "men",
    summary: "Dunkelhäutiges Model, schlank-athletisch, ruhiger Studio-Look wie bei großen Modeketten.",
    aspect: "3:4",
    prompt:
      "Professional e-commerce fashion photograph of a dark-skinned male model in his early 20s with short cropped hair and a slim athletic build, standing relaxed with one hand in his pocket, full body framing from head to mid-thigh, looking calmly at the camera. He is wearing {garment}{fit}. Light grey seamless studio backdrop, soft diffused key light with gentle shadows, 85mm lens, natural skin texture. {extra}",
  },
  {
    id: "men-studio-beige",
    label: "Herren · Studio beige",
    group: "Studio",
    gender: "men",
    summary: "Europäisches Model, 25–30, warmer beiger Hintergrund, freundlich und nahbar.",
    aspect: "3:4",
    prompt:
      "Professional e-commerce fashion photograph of a European male model aged 25 to 30 with short brown hair and light stubble, medium athletic build, standing straight with arms relaxed at his sides, full body framing, slight friendly smile. He is wearing {garment}{fit}. Warm beige seamless studio backdrop, soft even lighting, clean commercial catalog look, 70mm lens. {extra}",
  },
  {
    id: "women-studio-cream",
    label: "Damen · Studio creme",
    group: "Studio",
    gender: "women",
    summary: "Schlankes Model mit mittellangem Haar, heller cremefarbener Studio-Hintergrund.",
    aspect: "3:4",
    prompt:
      "Professional e-commerce fashion photograph of a female model aged 22 to 28 with shoulder-length dark hair and a slim build, standing in a relaxed contrapposto pose, full body framing, soft natural expression, looking at the camera. She is wearing {garment}{fit}. Cream seamless studio backdrop, soft diffused window-like light, 85mm lens, subtle natural makeup, natural skin texture. {extra}",
  },
  {
    id: "women-studio-curvy",
    label: "Damen · Studio curvy",
    group: "Studio",
    gender: "women",
    summary: "Curvy-Model für realistische Passform-Eindrücke, neutraler Hintergrund.",
    aspect: "3:4",
    prompt:
      "Professional e-commerce fashion photograph of a curvy plus-size female model aged 25 to 32 with long wavy hair, confident and warm expression, standing naturally with one hand on her hip, full body framing. She is wearing {garment}{fit}. Neutral light grey seamless studio backdrop, soft flattering light, 85mm lens, natural skin texture. {extra}",
  },
  {
    id: "unisex-studio-asian",
    label: "Unisex · Studio asiatisches Model",
    group: "Studio",
    gender: "unisex",
    summary: "Ostasiatisches Model, minimalistischer weißer Hintergrund, moderner Look.",
    aspect: "3:4",
    prompt:
      "Professional e-commerce fashion photograph of an East Asian model aged 20 to 26 with a modern medium-length haircut and a slim build, standing relaxed, full body framing, neutral expression. They are wearing {garment}{fit}. Pure white seamless studio backdrop, crisp even lighting, minimalist modern catalog look, 85mm lens. {extra}",
  },
  // ---------------------------------------------------------------- Street
  {
    id: "men-street-golden",
    label: "Herren · Straße goldene Stunde",
    group: "Street",
    gender: "men",
    summary: "Urbaner Streetwear-Look, Altstadtgasse im warmen Abendlicht.",
    aspect: "4:5",
    prompt:
      "Candid streetwear fashion photograph of a male model aged 22 to 28 with short curly hair, walking confidently down a narrow European old-town street during golden hour, full body framing, slight motion in his stride, warm low sun as rim light, shallow depth of field with a softly blurred background. He is wearing {garment}{fit}. Shot on 50mm, natural film-like color grading, authentic lifestyle feeling. {extra}",
  },
  {
    id: "women-street-city",
    label: "Damen · Straße Innenstadt",
    group: "Street",
    gender: "women",
    summary: "Modernes Stadtbild, Model läuft an einer hellen Fassade entlang.",
    aspect: "4:5",
    prompt:
      "Street style fashion photograph of a female model aged 22 to 30 with a sleek ponytail, walking past a light concrete building facade in a modern city, full body framing, relaxed confident stride, soft overcast daylight, shallow depth of field. She is wearing {garment}{fit}. Shot on 50mm, clean editorial street-style look, natural skin texture. {extra}",
  },
  {
    id: "men-street-night",
    label: "Herren · Nacht Neonlicht",
    group: "Street",
    gender: "men",
    summary: "Nächtliche Stadt, dezentes Neonlicht, Streetwear-Stimmung.",
    aspect: "4:5",
    prompt:
      "Cinematic night streetwear photograph of a male model aged 21 to 27 with short dark hair, standing under subtle neon signs on a wet city street, full body framing, moody but clearly lit product, soft colored reflections on the pavement, shallow depth of field. He is wearing {garment}{fit}. Shot on 35mm, realistic cinematic look, no readable text on any sign. {extra}",
  },
  // ------------------------------------------------------------- Lifestyle
  {
    id: "women-lifestyle-loft",
    label: "Damen · Lifestyle helles Loft",
    group: "Lifestyle",
    gender: "women",
    summary: "Helles Loft mit Fenster, entspannte Alltagssituation.",
    aspect: "4:5",
    prompt:
      "Natural lifestyle fashion photograph of a female model aged 24 to 30 with loosely tied hair, standing next to a large window in a bright minimalist loft apartment, holding a ceramic coffee cup, relaxed candid moment, three-quarter body framing, soft natural window light. She is wearing {garment}{fit}. Shot on 50mm, airy and warm, natural skin texture. {extra}",
  },
  {
    id: "men-lifestyle-cafe",
    label: "Herren · Lifestyle Café",
    group: "Lifestyle",
    gender: "men",
    summary: "Entspannte Café-Szene, lässig und alltagstauglich.",
    aspect: "4:5",
    prompt:
      "Natural lifestyle fashion photograph of a male model aged 25 to 32 with a short beard, sitting casually at a small table outside a quiet European café, looking away from the camera with a slight smile, three-quarter body framing, soft afternoon light. He is wearing {garment}{fit}. Shot on 50mm, shallow depth of field, authentic and relaxed mood, natural skin texture. {extra}",
  },
  {
    id: "unisex-lifestyle-park",
    label: "Unisex · Lifestyle Park",
    group: "Lifestyle",
    gender: "unisex",
    summary: "Sonniger Stadtpark, frische Alltagsstimmung.",
    aspect: "4:5",
    prompt:
      "Natural lifestyle fashion photograph of a model aged 20 to 28 walking through a sunny city park with green trees in the background, full body framing, relaxed natural movement, soft sunlight with gentle shadows. They are wearing {garment}{fit}. Shot on 50mm, fresh summery mood, shallow depth of field, natural skin texture. {extra}",
  },
  // ------------------------------------------------------------- Editorial
  {
    id: "unisex-editorial-dark",
    label: "Unisex · Editorial dunkel",
    group: "Editorial",
    gender: "unisex",
    summary: "Hochwertiger Magazin-Look, dunkler Hintergrund, dramatisches Licht.",
    aspect: "3:4",
    prompt:
      "High-end fashion editorial photograph of a model with sharp features and a confident, serious gaze, standing in front of a dark charcoal backdrop, full body framing, dramatic soft-box lighting with a subtle rim light that shows the fabric texture of the product. They are wearing {garment}{fit}. Shot on 85mm, magazine-quality, restrained color palette, natural skin texture. {extra}",
  },
  {
    id: "women-editorial-sun",
    label: "Damen · Editorial Sonnenlicht",
    group: "Editorial",
    gender: "women",
    summary: "Warmes Sonnenlicht und harte Schatten an einer Wand, modernes Magazin.",
    aspect: "3:4",
    prompt:
      "Modern fashion editorial photograph of a female model aged 22 to 30 with a short bob haircut, posed elegantly against a sunlit warm-toned plaster wall with strong graphic shadows, full body framing, direct warm sunlight. She is wearing {garment}{fit}. Shot on 85mm, high-fashion magazine look, natural skin texture. {extra}",
  },
  // --------------------------------------------------------------- Produkt
  {
    id: "product-ghost",
    label: "Produkt · Ghost-Mannequin",
    group: "Produkt",
    gender: "unisex",
    summary: "Unsichtbare Puppe: Kleidungsstück wirkt getragen, ohne Person.",
    aspect: "3:4",
    prompt:
      "Ghost mannequin product photograph of {garment}{fit}, shown front view as if worn by an invisible body so the garment keeps its natural 3D shape, no person, no mannequin visible, centered, pure white seamless background with a very soft ground shadow, even studio lighting, high detail on fabric texture. {extra}",
  },
  {
    id: "product-flatlay",
    label: "Produkt · Flat Lay",
    group: "Produkt",
    gender: "unisex",
    summary: "Draufsicht auf hellem Untergrund, sauber ausgerichtet.",
    aspect: "1:1",
    prompt:
      "Top-down flat lay product photograph of {garment}{fit}, neatly laid out and smoothed on a light neutral surface, sleeves and edges symmetrically arranged, soft shadow, even natural daylight, clean minimal catalog look, high detail on fabric texture. {extra}",
  },
  {
    id: "unisex-back-view",
    label: "Unisex · Rückenansicht am Model",
    group: "Produkt",
    gender: "unisex",
    summary: "Model von hinten. Nur sinnvoll, wenn ein Rückenfoto als Referenz gewählt ist.",
    aspect: "3:4",
    prompt:
      "Professional e-commerce fashion photograph of a model seen from behind, standing straight, full body framing, head turned slightly to the side. They are wearing {garment}{fit}, showing the back of the garment exactly as in the back-view reference photo if one is provided. Light grey seamless studio backdrop, soft diffused light, 85mm lens. {extra}",
  },
  {
    id: "unisex-detail",
    label: "Unisex · Detail am Model",
    group: "Produkt",
    gender: "unisex",
    summary: "Nahaufnahme von Stoff, Print oder Verarbeitung am Körper.",
    aspect: "4:5",
    prompt:
      "Close-up detail fashion photograph of a model wearing {garment}{fit}, cropped from chin to waist, focusing on the fabric texture, print and stitching of the garment, shallow depth of field, soft natural light, neutral blurred background, no face visible. {extra}",
  },
];

export type TemplateContext = {
  /** z. B. "oversized black t-shirt with a white bird print" */
  garment?: string;
  color?: string;
  fit?: string;
  extra?: string;
};

/** Ersetzt die Platzhalter. Fehlende Werte werden sauber entfernt, nicht als "{garment}" stehen gelassen. */
export function renderTemplate(
  template: Pick<ModelTemplate, "prompt">,
  ctx: TemplateContext,
): string {
  const garment =
    (ctx.garment || "").trim() ||
    "the garment shown in the reference photo";
  const fit = (ctx.fit || "").trim();
  return template.prompt
    .replaceAll("{garment}", garment)
    .replaceAll("{color}", (ctx.color || "").trim())
    .replaceAll("{fit}", fit ? ` (${fit})` : "")
    .replaceAll("{extra}", (ctx.extra || "").trim())
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function templateById(id: string) {
  return MODEL_TEMPLATES.find((t) => t.id === id);
}
