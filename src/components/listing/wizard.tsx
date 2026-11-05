"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Notice } from "@/components/commerce/client";
import { ChipInput } from "./chip-input";
import {
  MODEL_TEMPLATES,
  ASPECT_RATIOS,
  GARMENT_RULES,
  renderTemplate,
  type ModelTemplate,
} from "@/lib/commerce/listing-templates";

/**
 * KI-Listing-Assistent (FRONTEND, läuft im Browser des Admins).
 *
 * Der Wizard spricht nur mit /api/commerce/admin/listing/... und /api/commerce/products/...
 * Alle KI-Aufrufe passieren auf dem Server; hier liegt nie ein API-Schlüssel.
 */

const STEPS = [
  "Quelle",
  "Bilder",
  "Varianten",
  "Listing",
  "Model-Fotos",
  "Veröffentlichen",
] as const;

type Colour = { name: string; hex: string };
type Faq = { q: string; a: string };
type Form = {
  multi: boolean | null;
  colors: Colour[];
  sizes: string[];
  features: string[];
  gender: string;
  categoryId: string;
  productType: string;
  brand: string;
  material: string;
  fit: string;
  notes: string;
  purchaseCny: string;
  availability: "review" | "available";
  priceApproved: boolean;
  procurementUrl: string;
  title: string;
  tagline: string;
  description: string;
  highlights: string;
  care: string;
  sizeGuide: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  faq: Faq[];
  publication: "draft" | "review" | "published";
};

const emptyForm: Form = {
  multi: null,
  colors: [],
  sizes: [],
  features: [],
  gender: "",
  categoryId: "",
  productType: "",
  brand: "",
  material: "",
  fit: "",
  notes: "",
  purchaseCny: "",
  availability: "review",
  priceApproved: true,
  procurementUrl: "",
  title: "",
  tagline: "",
  description: "",
  highlights: "",
  care: "",
  sizeGuide: "",
  seoTitle: "",
  seoDescription: "",
  tags: [],
  faq: [],
  publication: "draft",
};

const SIZE_PRESETS: [string, string[]][] = [
  ["XS – XXL", ["XS", "S", "M", "L", "XL", "XXL"]],
  ["S – XL", ["S", "M", "L", "XL"]],
  ["Hosen 28 – 36", ["28", "29", "30", "31", "32", "33", "34", "36"]],
  ["Schuhe 36 – 46", Array.from({ length: 11 }, (_, i) => String(36 + i))],
  ["Einheitsgröße", ["One Size"]],
];

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** Direkter Aufruf ohne das globale "shop:changed"-Ereignis (der Wizard fragt oft nach). */
async function call(path: string, body?: unknown, method?: string) {
  const r = await fetch(`/api/commerce/${path}`, {
    method: method || (body !== undefined ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Anfrage fehlgeschlagen.");
  return d;
}

const KNOWN_PLACEHOLDER_BRANDS = ["Fashion / Unbranded", "—"];

function formFromProduct(p: any): Form {
  const l = p.listing || {};
  const generated = Boolean(l.generated_at);
  const firstFen = p.variants?.find((v: any) => v.purchase_fen)?.purchase_fen;
  return {
    ...emptyForm,
    title: p.title || "",
    description: generated ? p.description || "" : "",
    tagline: l.tagline || "",
    highlights: (l.highlights || []).join("\n"),
    care: (l.care || []).join("\n"),
    sizeGuide: l.size_guide || "",
    seoTitle: l.seo_title || "",
    seoDescription: l.seo_description || "",
    tags: l.tags || [],
    faq: l.faq || [],
    colors: l.colors || [],
    multi: generated ? (l.colors || []).length > 1 : null,
    sizes: generated
      ? [...new Set<string>((p.variants || []).map((v: any) => v.size).filter(Boolean))]
      : [],
    brand: KNOWN_PLACEHOLDER_BRANDS.includes(p.brand) ? "" : p.brand || "",
    gender: p.gender || "",
    categoryId: p.category_ids?.[0] || "",
    material: p.material || "",
    fit: p.fit || "",
    purchaseCny: p.purchase_cny
      ? String(p.purchase_cny)
      : firstFen
        ? String(Number(firstFen) / 100)
        : "",
    procurementUrl: p.procurement_url || "",
    publication: p.publication === "archived" ? "draft" : p.publication,
  };
}

export function ListingWizard() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  // Schritt 1
  const [url, setUrl] = useState("");
  const [taobao, setTaobao] = useState("");
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<any>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [importInfo, setImportInfo] = useState<any>(null);

  // Produkt + Formular
  const [productId, setProductId] = useState<number | null>(null);
  const [product, setProduct] = useState<any>(null);
  const [categoryList, setCategoryList] = useState<any[]>([]);
  const [form, setFormState] = useState<Form>(emptyForm);
  const setForm = useCallback(
    (patch: Partial<Form>) => setFormState((f) => ({ ...f, ...patch })),
    [],
  );
  const [analysis, setAnalysis] = useState<any>(null);
  const analysedFor = useRef<number | null>(null);

  // Model-Fotos
  const [templateId, setTemplateId] = useState("");
  const [garment, setGarment] = useState("");
  const [extra, setExtra] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptEdited, setPromptEdited] = useState(false);
  const [aspect, setAspect] = useState("3:4");
  const [count, setCount] = useState(1);
  const [refs, setRefs] = useState<number[]>([]);
  const [genderFilter, setGenderFilter] = useState("all");
  const [progress, setProgress] = useState("");

  // Fertig
  const [saved, setSaved] = useState<any>(null);

  const aiReady = Boolean(config?.configured);

  useEffect(() => {
    call("admin/listing/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  // ------------------------------------------------------------------ Produkt laden

  const loadProduct = useCallback(async (id: number) => {
    const d = await call(`products/${id}`);
    setProduct(d.product);
    setCategoryList(d.categories || []);
    return d.product;
  }, []);

  const openProduct = useCallback(
    async (id: number, info?: any) => {
      const p = await loadProduct(id);
      let stored: Partial<Form> = {};
      try {
        stored = JSON.parse(localStorage.getItem(`listing-wizard:${id}`) || "{}");
      } catch {}
      setFormState({ ...formFromProduct(p), ...stored });
      setProductId(id);
      setImportInfo(info || null);
      window.history.replaceState(null, "", `/admin/listing?product=${id}`);
      return p;
    },
    [loadProduct],
  );

  // Wiederaufnahme nach Neuladen: /admin/listing?product=123
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("product"));
    if (id > 0)
      openProduct(id)
        .then(() => setStep(1))
        .catch((e) => setError(e.message));
  }, [openProduct]);

  // Eingaben bleiben im Browser erhalten, falls die Seite neu geladen wird.
  useEffect(() => {
    if (productId)
      localStorage.setItem(`listing-wizard:${productId}`, JSON.stringify(form));
  }, [form, productId]);

  // ------------------------------------------------------------------ Schritt 1: Import

  async function start() {
    setError("");
    setNotice("");
    setBusy("start");
    try {
      const d = await call("admin/listing/start", {
        url,
        procurement_url: taobao,
      });
      setJob(null);
      setStartedAt(Date.now());
      setJobId(d.job_id);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const j = await call(`admin/listing/jobs/${jobId}`);
        if (stop) return;
        setJob(j);
        if (j.status === "done") {
          setJobId(null);
          await openProduct(j.result.product_id, j.result);
          setBusy("");
          setStep(1);
        } else if (j.status === "failed") {
          setJobId(null);
          setBusy("");
          setError(j.error || "Der Import ist fehlgeschlagen.");
        }
      } catch (e) {
        if (!stop) {
          setJobId(null);
          setBusy("");
          setError((e as Error).message);
        }
      }
    };
    void tick();
    const timer = setInterval(tick, 2000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [jobId, openProduct]);

  // ------------------------------------------------------------------ Schritt 2: Bilder

  const photos: any[] = useMemo(() => product?.media || [], [product]);

  async function saveGallery(media: any[]) {
    if (!productId) return;
    setBusy("gallery");
    setError("");
    try {
      await call(
        `products/${productId}/gallery`,
        {
          media: media.map((m, position) => ({
            id: m.id,
            position,
            alt: m.alt,
            kind: m.kind,
          })),
        },
        "PATCH",
      );
      await loadProduct(productId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const makeHero = (id: number) => {
    const m = photos.find((x) => x.id === id);
    if (m) void saveGallery([m, ...photos.filter((x) => x.id !== id)]);
  };
  const toggleSizeChart = (id: number) =>
    void saveGallery(
      photos.map((m) =>
        m.id === id
          ? { ...m, kind: m.kind === "size_chart" ? "product" : "size_chart" }
          : m,
      ),
    );
  async function removePhoto(id: number) {
    if (!productId || !window.confirm("Dieses Bild endgültig entfernen?")) return;
    setBusy("gallery");
    try {
      await call(`products/${productId}/media/${id}`, undefined, "DELETE");
      setRefs((r) => r.filter((x) => x !== id));
      await loadProduct(productId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // ------------------------------------------------------------------ Schritt 3: KI-Vorschläge

  function applyAnalysis(a: any, overwrite: boolean) {
    const empty = (v: unknown) => !v || (Array.isArray(v) && !v.length);
    const patch: Partial<Form> = {};
    const take = <K extends keyof Form>(key: K, value: Form[K]) => {
      if (!empty(value) && (overwrite || empty(form[key]))) patch[key] = value;
    };
    take("colors", a.colors);
    if (a.colors?.length && (overwrite || form.multi === null))
      patch.multi = a.colors.length > 1;
    take("sizes", a.sizes);
    take("features", a.features);
    take("productType", a.product_type);
    take("gender", a.gender);
    take("categoryId", a.category_id);
    take("material", a.material);
    take("fit", a.fit);
    setForm(patch);
  }

  const analyse = useCallback(
    async (overwrite: boolean) => {
      if (!productId) return;
      setBusy("analyze");
      setError("");
      try {
        const d = await call(`admin/listing/${productId}/analyze`, {});
        setAnalysis(d.analysis);
        applyAnalysis(d.analysis, overwrite);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy("");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productId, form],
  );

  // Beim ersten Betreten des Varianten-Schritts einmal automatisch Vorschläge holen.
  useEffect(() => {
    if (step === 2 && aiReady && productId && analysedFor.current !== productId) {
      analysedFor.current = productId;
      void analyse(false);
    }
  }, [step, aiReady, productId, analyse]);

  // ------------------------------------------------------------------ Schritt 4: Listing

  async function generate() {
    if (!productId) return;
    setBusy("generate");
    setError("");
    try {
      const d = await call(`admin/listing/${productId}/generate`, {
        product_type: form.productType,
        category_id: form.categoryId,
        gender: form.gender,
        colors: form.multi === false ? form.colors.slice(0, 1) : form.colors,
        sizes: form.sizes,
        features: form.features,
        material: form.material,
        fit: form.fit,
        brand: form.brand,
        notes: form.notes,
      });
      const c = d.copy;
      setForm({
        title: c.title,
        tagline: c.tagline,
        description: c.description,
        highlights: (c.highlights || []).join("\n"),
        care: (c.care || []).join("\n"),
        sizeGuide: c.size_guide,
        seoTitle: c.seo_title,
        seoDescription: c.seo_description,
        tags: c.tags,
        faq: c.faq,
        material: form.material || c.material,
        fit: form.fit || c.fit,
      });
      setNotice("Listing erzeugt. Bitte alles prüfen und anpassen.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // ------------------------------------------------------------------ Schritt 5: Model-Fotos

  const sourcePhotos = photos.filter((m) => m.kind === "product");
  const aiPhotos = photos.filter((m) => m.kind === "ai_model");
  const colourName = form.colors[0]?.name || "";

  // Standard: die ersten zwei Produktfotos als Referenz.
  useEffect(() => {
    if (step === 4 && !refs.length && sourcePhotos.length)
      setRefs(sourcePhotos.slice(0, 2).map((m) => m.id));
  }, [step, refs.length, sourcePhotos]);

  // Vorschlag für die Kleidungsstück-Beschreibung (Admin kann sie ändern).
  useEffect(() => {
    if (step === 4 && !garment)
      setGarment(
        [form.productType || form.title, colourName, ...form.features.slice(0, 3)]
          .filter(Boolean)
          .join(", "),
      );
  }, [step, garment, form.productType, form.title, colourName, form.features]);

  const template = MODEL_TEMPLATES.find((t) => t.id === templateId);
  useEffect(() => {
    if (template && !promptEdited)
      setPrompt(renderTemplate(template, { garment, fit: form.fit, extra }));
  }, [template, garment, extra, form.fit, promptEdited]);

  function chooseTemplate(t: ModelTemplate) {
    setTemplateId(t.id);
    setAspect(t.aspect);
    setPromptEdited(false);
    setPrompt(renderTemplate(t, { garment, fit: form.fit, extra }));
  }

  async function makeShots() {
    if (!productId) return;
    setError("");
    setNotice("");
    let done = 0;
    try {
      for (let i = 1; i <= count; i++) {
        setProgress(`Bild ${i} von ${count} wird erzeugt … (ca. 20–60 Sekunden)`);
        await call(`admin/listing/${productId}/model-shot`, {
          prompt,
          reference_media_ids: refs,
          aspect_ratio: aspect,
        });
        done++;
        await loadProduct(productId);
      }
      setNotice(`${done} Model-Foto${done === 1 ? "" : "s"} erzeugt und zur Galerie hinzugefügt.`);
    } catch (e) {
      setError(
        (done ? `${done} Bild(er) fertig. ` : "") + (e as Error).message,
      );
    } finally {
      setProgress("");
    }
  }

  // ------------------------------------------------------------------ Schritt 6: Speichern

  const variantCount =
    Math.max(form.multi === false ? Math.min(form.colors.length, 1) : form.colors.length, 1) *
    Math.max(form.sizes.length, 1);
  const checks = [
    { ok: Boolean(form.title.trim()), text: "Titel", required: true },
    { ok: Boolean(form.description.trim()), text: "Beschreibung" },
    { ok: sourcePhotos.length + aiPhotos.length > 0, text: "Mindestens ein Produktbild", required: true },
    { ok: Boolean(form.purchaseCny && Number(form.purchaseCny) > 0), text: "Einkaufspreis (CNY)", required: true },
    { ok: Boolean(form.procurementUrl), text: "Bestelllink (Taobao/Weidian)" },
    { ok: Boolean(form.categoryId), text: "Kategorie" },
    { ok: form.sizes.length > 0, text: "Größen" },
  ];
  const publishable = checks.filter((c) => c.required).every((c) => c.ok);

  async function save() {
    if (!productId) return;
    setBusy("save");
    setError("");
    try {
      const d = await call(`admin/listing/${productId}/apply`, {
        copy: {
          title: form.title,
          tagline: form.tagline,
          description: form.description,
          highlights: lines(form.highlights),
          material: form.material,
          fit: form.fit,
          care: lines(form.care),
          size_guide: form.sizeGuide,
          seo_title: form.seoTitle,
          seo_description: form.seoDescription,
          tags: form.tags,
          faq: form.faq,
        },
        brand: form.brand,
        gender: form.gender,
        category_id: form.categoryId,
        colors: form.multi === false ? form.colors.slice(0, 1) : form.colors,
        sizes: form.sizes,
        purchase_cny: form.purchaseCny === "" ? null : Number(form.purchaseCny),
        availability: form.availability,
        price_approved: form.priceApproved,
        procurement_url: form.procurementUrl,
        publication: form.publication,
      });
      setSaved(d);
      await loadProduct(productId);
      localStorage.removeItem(`listing-wizard:${productId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function reset() {
    window.history.replaceState(null, "", "/admin/listing");
    setStep(0);
    setProductId(null);
    setProduct(null);
    setFormState(emptyForm);
    setAnalysis(null);
    analysedFor.current = null;
    setSaved(null);
    setImportInfo(null);
    setUrl("");
    setTaobao("");
    setRefs([]);
    setGarment("");
    setPrompt("");
    setTemplateId("");
    setError("");
    setNotice("");
  }

  // ------------------------------------------------------------------ Darstellung

  const categoryOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    const walk = (parent: string | null, depth: number) =>
      categoryList
        .filter((c) => (c.parent_id ?? null) === parent)
        .forEach((c) => {
          out.push({ id: c.id, label: `${"— ".repeat(depth)}${c.label}` });
          walk(c.id, depth + 1);
        });
    walk(null, 0);
    return out;
  }, [categoryList]);

  const waitedLong =
    jobId && job?.status !== "running" && Date.now() - startedAt > 20000;
  const canGo = (i: number) => i === 0 || Boolean(productId);

  return (
    <div className="space-y-6">
      <nav aria-label="Schritte" className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={!canGo(i)}
            aria-current={step === i ? "step" : undefined}
            className={`commerce-tab ${step === i ? "selected" : ""} disabled:opacity-40`}
            onClick={() => canGo(i) && setStep(i)}
          >
            <span className="mr-2 text-muted-foreground">{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      <Notice error={error} text={notice} />

      {/* ---------------------------------------------------------- 1 Quelle */}
      {step === 0 && (
        <section className="commerce-panel space-y-5">
          <div>
            <h2 className="text-xl">Produkt aus Yupoo importieren</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Füge den Link zum Yupoo-Album ein. Bilder, Titel, Beschreibung,
              Größen-/Farbhinweise und der Bestelllink (Taobao/Weidian) werden
              automatisch ausgelesen. Das Produkt wird als <b>Entwurf</b>{" "}
              gespeichert und ist für Kunden unsichtbar.
            </p>
          </div>
          {config && !config.configured && (
            <p className="commerce-notice">
              KI ist noch nicht freigeschaltet
              {!config.has_key ? " (GEMINI_API_KEY fehlt)" : ""}
              {!config.consent
                ? " (LISTING_AI_IMAGE_CONSENT=gemini fehlt – das ist deine ausdrückliche Freigabe, Bilder an Google zu senden)"
                : ""}
              . Der Import funktioniert trotzdem; Vorschläge, Texte und
              Model-Fotos brauchen die KI.
            </p>
          )}
          <label className="commerce-field">
            Yupoo-Album-Link
            <input
              className="commerce-input"
              type="url"
              placeholder="https://xyz.x.yupoo.com/albums/123456789"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="commerce-field">
            Bestelllink Taobao / Weidian (optional, nur für dich als Admin)
            <input
              className="commerce-input"
              type="url"
              placeholder="https://item.taobao.com/item.htm?id=1053760707180"
              value={taobao}
              onChange={(e) => setTaobao(e.target.value)}
            />
            <span className="text-xs">
              Wird sonst aus der Albumbeschreibung gelesen. Tracking-Teile wie
              „spm=…“ entfernen wir automatisch.
            </span>
          </label>
          <button
            type="button"
            className="commerce-button"
            disabled={!url.trim() || busy === "start" || Boolean(jobId)}
            onClick={start}
          >
            {jobId || busy === "start" ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            Daten extrahieren
          </button>
          {jobId && (
            <div role="status" className="space-y-2 text-sm">
              <p>
                {job?.status === "running"
                  ? "Bilder und Daten werden gelesen … das kann bei vielen Bildern eine Minute dauern."
                  : "Auftrag wartet auf den Import-Worker …"}
              </p>
              {job?.attempts > 1 && (
                <p className="text-muted-foreground">
                  Versuch {job.attempts} von 5
                  {job.error ? `: ${job.error}` : ""}
                </p>
              )}
              {waitedLong && (
                <p className="text-muted-foreground">
                  Dauert ungewöhnlich lange. Läuft der Worker?{" "}
                  <code>npm run worker</code> (bzw. der Worker-Container).
                </p>
              )}
            </div>
          )}
          {productId && (
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setStep(1)}
            >
              Weiter mit Produkt #{productId}
            </button>
          )}
        </section>
      )}

      {/* ---------------------------------------------------------- 2 Bilder */}
      {step === 1 && product && (
        <section className="space-y-6">
          {importInfo?.already_existed && (
            <p className="commerce-notice">
              Dieses Produkt war schon im Shop (Status:{" "}
              <b>{importInfo.publication}</b>). Wenn du am Ende speicherst,
              werden Titel, Texte und Varianten überschrieben.
            </p>
          )}
          {(importInfo?.warnings || []).map((w: string) => (
            <p key={w} className="text-sm text-muted-foreground">
              • {w}
            </p>
          ))}
          <div className="commerce-panel grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-xl">Extrahierte Daten</h2>
              <p className="commerce-eyebrow">Titel der Quelle</p>
              <p className="text-sm">{product.title}</p>
              <p className="commerce-eyebrow">Beschreibung der Quelle</p>
              <p className="max-h-48 overflow-auto whitespace-pre-line text-sm text-muted-foreground">
                {product.description || "Keine Beschreibung gefunden."}
              </p>
              <p className="text-sm">
                Preis laut Quelle:{" "}
                <b>
                  {product.purchase_cny
                    ? `${product.purchase_cny} CNY`
                    : "nicht erkannt"}
                </b>
              </p>
              <a
                className="inline-flex items-center gap-1 text-xs underline"
                href={product.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Yupoo-Album öffnen <ExternalLink size={12} />
              </a>
            </div>
            <div className="space-y-3">
              <h2 className="text-xl">Bestelllink (nur für dich)</h2>
              <p className="text-sm text-muted-foreground">
                Diesen Link bekommst du in Lieferantenaufträgen, sobald ein
                Kunde bestellt. Kunden sehen ihn nie.
              </p>
              <input
                aria-label="Bestelllink"
                className="commerce-input w-full"
                placeholder="https://item.taobao.com/item.htm?id=…"
                value={form.procurementUrl}
                onChange={(e) => setForm({ procurementUrl: e.target.value })}
              />
              {(product.procurement_links || []).length > 0 ? (
                <div className="space-y-1 text-sm">
                  <p className="commerce-eyebrow">Gefundene Links</p>
                  {product.procurement_links.map((l: string) => (
                    <div key={l} className="flex items-center gap-3">
                      <button
                        type="button"
                        className="underline break-all text-left"
                        onClick={() => setForm({ procurementUrl: l })}
                      >
                        {l}
                      </button>
                      <a href={l} target="_blank" rel="noreferrer" aria-label="Link öffnen">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  In der Quelle wurde kein Bestelllink gefunden. Bitte oben
                  eintragen.
                </p>
              )}
            </div>
          </div>
          <div className="commerce-panel space-y-4">
            <div>
              <h2 className="text-xl">Bilder prüfen ({photos.length})</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Entferne Verpackung, Kontakt- und Lagerbilder. Markiere
                Größentabellen. Das erste Bild ist das Titelbild.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {photos.map((m, i) => (
                <figure key={m.id} className="space-y-2">
                  <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                    <img
                      src={`${m.url}?w=240`}
                      alt={m.alt || `Bild ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 flex gap-1">
                      {i === 0 && <span className="commerce-status">Titelbild</span>}
                      {m.kind === "size_chart" && (
                        <span className="commerce-status">Größentabelle</span>
                      )}
                      {m.kind === "ai_model" && (
                        <span className="commerce-status">KI</span>
                      )}
                    </span>
                  </div>
                  <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {i > 0 && m.kind !== "size_chart" && (
                      <button
                        type="button"
                        className="underline"
                        disabled={busy === "gallery"}
                        onClick={() => makeHero(m.id)}
                      >
                        Titelbild
                      </button>
                    )}
                    {m.kind !== "ai_model" && (
                      <button
                        type="button"
                        className="underline"
                        disabled={busy === "gallery"}
                        onClick={() => toggleSizeChart(m.id)}
                      >
                        {m.kind === "size_chart" ? "Kein Größenbild" : "Größentabelle"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-red-400"
                      disabled={busy === "gallery"}
                      onClick={() => removePhoto(m.id)}
                    >
                      <Trash2 size={12} />
                      Entfernen
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
            {!photos.length && (
              <p className="text-sm text-muted-foreground">
                Es konnten keine Bilder übernommen werden. Prüfe den Link oder
                starte den Import erneut.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- 3 Varianten */}
      {step === 2 && product && (
        <section className="space-y-6">
          <div className="commerce-panel flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl">Farben, Größen und Merkmale</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Die KI schaut sich die Fotos an und füllt leere Felder vor.
                Du entscheidest, was stimmt.
              </p>
            </div>
            <button
              type="button"
              className="commerce-button secondary"
              disabled={!aiReady || busy === "analyze"}
              onClick={() => void analyse(true)}
            >
              {busy === "analyze" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              Vorschläge neu holen
            </button>
          </div>
          {analysis?.notes?.length > 0 && (
            <ul className="commerce-notice space-y-1 text-sm">
              {analysis.notes.map((n: string) => (
                <li key={n}>KI-Hinweis: {n}</li>
              ))}
            </ul>
          )}

          <div className="commerce-panel space-y-4">
            <h3 className="text-lg">1. Gibt es mehrere Farben?</h3>
            <div className="flex gap-2">
              {[
                [true, "Ja, mehrere Farben"],
                [false, "Nein, nur eine Farbe"],
              ].map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={form.multi === value}
                  className={`commerce-option ${form.multi === value ? "selected" : ""}`}
                  onClick={() => setForm({ multi: value as boolean })}
                >
                  {label as string}
                </button>
              ))}
            </div>
            {form.multi === true && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Welche Farben? Jede Farbe wird eine eigene Auswahl im Shop.
                </p>
                {form.colors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`Farbton für ${c.name || "Farbe"}`}
                      className="h-11 w-12 cursor-pointer rounded border border-border bg-transparent"
                      value={c.hex || "#cccccc"}
                      onChange={(e) =>
                        setForm({
                          colors: form.colors.map((x, j) =>
                            j === i ? { ...x, hex: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label="Farbname"
                      className="commerce-input flex-1"
                      placeholder="z. B. Schwarz"
                      value={c.name}
                      onChange={(e) =>
                        setForm({
                          colors: form.colors.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Farbe entfernen"
                      onClick={() =>
                        setForm({ colors: form.colors.filter((_, j) => j !== i) })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="commerce-button secondary"
                  onClick={() =>
                    setForm({ colors: [...form.colors, { name: "", hex: "" }] })
                  }
                >
                  <Plus size={14} /> Farbe hinzufügen
                </button>
              </div>
            )}
            {form.multi === false && (
              <label className="commerce-field max-w-sm">
                Farbe (optional)
                <input
                  className="commerce-input"
                  placeholder="z. B. Schwarz"
                  value={form.colors[0]?.name || ""}
                  onChange={(e) =>
                    setForm({
                      colors: [{ name: e.target.value, hex: form.colors[0]?.hex || "" }],
                    })
                  }
                />
              </label>
            )}
          </div>

          <div className="commerce-panel space-y-4">
            <h3 className="text-lg">2. Welche Größen gibt es?</h3>
            <div className="flex flex-wrap gap-2">
              {SIZE_PRESETS.map(([label, sizes]) => (
                <button
                  key={label}
                  type="button"
                  className="commerce-option"
                  onClick={() => setForm({ sizes })}
                >
                  {label}
                </button>
              ))}
            </div>
            <ChipInput
              label="Größen"
              placeholder="Größe eingeben, mit Enter bestätigen"
              value={form.sizes}
              onChange={(sizes) => setForm({ sizes })}
            />
            <p className="text-xs text-muted-foreground">
              Ohne Größen entsteht eine Einheitsgröße. Insgesamt{" "}
              <b>{variantCount}</b> Variante{variantCount === 1 ? "" : "n"} (Farben × Größen).
            </p>
          </div>

          <div className="commerce-panel space-y-4">
            <h3 className="text-lg">3. Merkmale</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="commerce-field">
                Produktart
                <input
                  className="commerce-input"
                  placeholder="z. B. Oversized T-Shirt"
                  value={form.productType}
                  onChange={(e) => setForm({ productType: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                Kategorie
                <select
                  className="commerce-input"
                  value={form.categoryId}
                  onChange={(e) => setForm({ categoryId: e.target.value })}
                >
                  <option value="">Bitte wählen</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="commerce-field">
                Zielgruppe
                <select
                  className="commerce-input"
                  value={form.gender}
                  onChange={(e) => setForm({ gender: e.target.value })}
                >
                  <option value="">Unbekannt</option>
                  <option value="men">Herren</option>
                  <option value="women">Damen</option>
                  <option value="unisex">Unisex</option>
                </select>
              </label>
              <label className="commerce-field">
                Marke / Label (leer = „Fashion Supply“)
                <input
                  className="commerce-input"
                  value={form.brand}
                  onChange={(e) => setForm({ brand: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                Material (nur wenn sicher bekannt)
                <input
                  className="commerce-input"
                  placeholder="z. B. 100 % Baumwolle"
                  value={form.material}
                  onChange={(e) => setForm({ material: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                Passform
                <input
                  className="commerce-input"
                  placeholder="z. B. Oversized, Regular Fit"
                  value={form.fit}
                  onChange={(e) => setForm({ fit: e.target.value })}
                />
              </label>
            </div>
            <div className="commerce-field">
              Besondere Merkmale
              <ChipInput
                label="Merkmale"
                placeholder="z. B. Kubakragen, Knopfleiste, Stickerei"
                value={form.features}
                max={12}
                onChange={(features) => setForm({ features })}
              />
            </div>
            <label className="commerce-field">
              Weitere Hinweise für die KI (optional)
              <textarea
                rows={3}
                className="commerce-input"
                placeholder="z. B. Zielgruppe, Anlass, Stil, was betont werden soll"
                value={form.notes}
                onChange={(e) => setForm({ notes: e.target.value })}
              />
            </label>
          </div>

          <div className="commerce-panel space-y-4">
            <h3 className="text-lg">4. Einkaufspreis und Verfügbarkeit</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="commerce-field">
                Einkaufspreis in CNY (pro Variante)
                <input
                  className="commerce-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.purchaseCny}
                  onChange={(e) => setForm({ purchaseCny: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                Verfügbarkeit
                <select
                  className="commerce-input"
                  value={form.availability}
                  onChange={(e) =>
                    setForm({ availability: e.target.value as Form["availability"] })
                  }
                >
                  <option value="review">Prüfen (vor Angebot bestätigen)</option>
                  <option value="available">Bestellbar</option>
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.priceApproved}
                  onChange={(e) => setForm({ priceApproved: e.target.checked })}
                />
                Preis ist von mir geprüft
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Den Kundenpreis berechnet der Shop aus Wechselkurs und Gebühren
              (Einstellungen). Er wird nach dem Speichern angezeigt.
            </p>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- 4 Listing */}
      {step === 3 && product && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div className="commerce-panel flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl">Listing-Texte</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Die KI schreibt Titel, Beschreibung, Highlights, Größenhinweis,
                  FAQ und SEO aus deinen Angaben. Erfunden wird nichts:
                  unbekanntes Material bleibt leer.
                </p>
              </div>
              <button
                type="button"
                className="commerce-button"
                disabled={!aiReady || busy === "generate"}
                onClick={generate}
              >
                {busy === "generate" ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                {form.tagline ? "Neu erzeugen" : "Listing mit KI erzeugen"}
              </button>
            </div>
            {!aiReady && (
              <p className="commerce-notice">
                KI nicht freigeschaltet. Du kannst die Texte auch von Hand schreiben.
              </p>
            )}
            <div className="commerce-panel space-y-4">
              <label className="commerce-field">
                Titel
                <input
                  className="commerce-input"
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm({ title: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                Kurzbeschreibung (steht direkt unter dem Preis)
                <input
                  className="commerce-input"
                  maxLength={220}
                  value={form.tagline}
                  onChange={(e) => setForm({ tagline: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                Beschreibung
                <textarea
                  rows={8}
                  className="commerce-input"
                  value={form.description}
                  onChange={(e) => setForm({ description: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                Highlights (eine pro Zeile)
                <textarea
                  rows={5}
                  className="commerce-input"
                  value={form.highlights}
                  onChange={(e) => setForm({ highlights: e.target.value })}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="commerce-field">
                  Material
                  <input
                    className="commerce-input"
                    value={form.material}
                    onChange={(e) => setForm({ material: e.target.value })}
                  />
                </label>
                <label className="commerce-field">
                  Passform
                  <input
                    className="commerce-input"
                    value={form.fit}
                    onChange={(e) => setForm({ fit: e.target.value })}
                  />
                </label>
              </div>
              <label className="commerce-field">
                Pflegehinweise (einer pro Zeile)
                <textarea
                  rows={3}
                  className="commerce-input"
                  value={form.care}
                  onChange={(e) => setForm({ care: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                Größenhinweis
                <textarea
                  rows={3}
                  className="commerce-input"
                  value={form.sizeGuide}
                  onChange={(e) => setForm({ sizeGuide: e.target.value })}
                />
              </label>
            </div>
            <div className="commerce-panel space-y-4">
              <h3 className="text-lg">Häufige Fragen</h3>
              {form.faq.map((f, i) => (
                <div key={i} className="space-y-2 border border-border p-3">
                  <input
                    aria-label="Frage"
                    className="commerce-input w-full"
                    placeholder="Frage"
                    value={f.q}
                    onChange={(e) =>
                      setForm({
                        faq: form.faq.map((x, j) =>
                          j === i ? { ...x, q: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <textarea
                    aria-label="Antwort"
                    rows={2}
                    className="commerce-input w-full"
                    placeholder="Antwort"
                    value={f.a}
                    onChange={(e) =>
                      setForm({
                        faq: form.faq.map((x, j) =>
                          j === i ? { ...x, a: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() =>
                      setForm({ faq: form.faq.filter((_, j) => j !== i) })
                    }
                  >
                    Frage entfernen
                  </button>
                </div>
              ))}
              {form.faq.length < 6 && (
                <button
                  type="button"
                  className="commerce-button secondary"
                  onClick={() => setForm({ faq: [...form.faq, { q: "", a: "" }] })}
                >
                  <Plus size={14} /> Frage hinzufügen
                </button>
              )}
            </div>
            <div className="commerce-panel space-y-4">
              <h3 className="text-lg">Suchmaschine (SEO)</h3>
              <label className="commerce-field">
                SEO-Titel ({form.seoTitle.length}/60)
                <input
                  className="commerce-input"
                  maxLength={70}
                  value={form.seoTitle}
                  onChange={(e) => setForm({ seoTitle: e.target.value })}
                />
              </label>
              <label className="commerce-field">
                SEO-Beschreibung ({form.seoDescription.length}/155)
                <textarea
                  rows={2}
                  className="commerce-input"
                  maxLength={170}
                  value={form.seoDescription}
                  onChange={(e) => setForm({ seoDescription: e.target.value })}
                />
              </label>
              <div className="commerce-field">
                Suchbegriffe
                <ChipInput
                  label="Suchbegriffe"
                  placeholder="Begriff eingeben, Enter"
                  value={form.tags}
                  max={12}
                  onChange={(tags) => setForm({ tags })}
                />
              </div>
            </div>
          </div>

          <aside className="self-start lg:sticky lg:top-24">
            <div className="commerce-panel space-y-3">
              <p className="commerce-eyebrow">Vorschau Produktseite</p>
              <div className="aspect-[3/4] overflow-hidden bg-secondary">
                {photos[0] && (
                  <img
                    src={`${photos[0].url}?w=640`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <p className="text-sm font-medium uppercase tracking-wide">
                {form.title || "Titel"}
              </p>
              <p className="text-xs text-muted-foreground">
                {form.tagline || "Kurzbeschreibung"}
              </p>
              {form.multi !== false && form.colors.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Farben">
                  {form.colors.map((c) => (
                    <span
                      key={c.name}
                      title={c.name}
                      className="h-7 w-7 rounded-sm border border-border"
                      style={{ background: c.hex || "#cccccc" }}
                    />
                  ))}
                </div>
              )}
              {form.sizes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.sizes.map((s) => (
                    <span key={s} className="border border-border px-2 py-1 text-[11px]">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {lines(form.highlights).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          </aside>
        </section>
      )}

      {/* ---------------------------------------------------------- 5 Model-Fotos */}
      {step === 4 && product && (
        <section className="space-y-6">
          <div className="commerce-panel space-y-2">
            <h2 className="text-xl">Model-Fotos mit KI</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Wähle eine Vorlage und ein bis drei Referenzfotos des
              Kleidungsstücks. Die KI zeigt genau dieses Teil an einem Model.
              Jedes Bild ist ein kostenpflichtiger KI-Aufruf. Prüfe das
              Ergebnis immer auf Farbe, Print und Schnitt, bevor du es
              behältst. Dieser Schritt ist optional.
            </p>
            {!aiReady && (
              <p className="commerce-notice">
                KI nicht freigeschaltet (GEMINI_API_KEY und
                LISTING_AI_IMAGE_CONSENT=gemini).
              </p>
            )}
          </div>

          <div className="commerce-panel space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg">1. Vorlage wählen</h3>
              <select
                aria-label="Zielgruppe filtern"
                className="commerce-input"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
              >
                <option value="all">Alle Models</option>
                <option value="men">Herren</option>
                <option value="women">Damen</option>
                <option value="unisex">Unisex / Produkt</option>
              </select>
            </div>
            {(["Studio", "Street", "Lifestyle", "Editorial", "Produkt"] as const).map(
              (group) => {
                const items = MODEL_TEMPLATES.filter(
                  (t) =>
                    t.group === group &&
                    (genderFilter === "all" || t.gender === genderFilter),
                );
                if (!items.length) return null;
                return (
                  <div key={group} className="space-y-2">
                    <p className="commerce-eyebrow">{group}</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={templateId === t.id}
                          onClick={() => chooseTemplate(t)}
                          className={`rounded border p-3 text-left ${templateId === t.id ? "border-foreground" : "border-border"}`}
                        >
                          <span className="block text-sm font-medium">{t.label}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {t.summary}
                          </span>
                          <span className="mt-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
                            Format {t.aspect}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              },
            )}
          </div>

          <div className="commerce-panel space-y-4">
            <h3 className="text-lg">2. Referenzfotos des Kleidungsstücks ({refs.length}/3)</h3>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {sourcePhotos.map((m) => {
                const on = refs.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Referenzfoto ${m.alt || m.id}`}
                    onClick={() =>
                      setRefs(
                        on
                          ? refs.filter((x) => x !== m.id)
                          : refs.length < 3
                            ? [...refs, m.id]
                            : refs,
                      )
                    }
                    className={`relative aspect-square overflow-hidden border-2 ${on ? "border-foreground" : "border-transparent"}`}
                  >
                    <img
                      src={`${m.url}?w=240`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {on && (
                      <span className="absolute right-1 top-1 rounded-full bg-foreground p-1 text-background">
                        <Check size={10} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Tipp: Vorder- und Rückansicht wählen, wenn der Print auf beiden
              Seiten wichtig ist.
            </p>
          </div>

          <div className="commerce-panel space-y-4">
            <h3 className="text-lg">3. Prompt prüfen und anpassen</h3>
            <label className="commerce-field">
              Kleidungsstück (am besten auf Englisch beschreiben)
              <input
                className="commerce-input"
                placeholder="oversized black t-shirt with a white bird print"
                value={garment}
                onChange={(e) => setGarment(e.target.value)}
              />
            </label>
            <label className="commerce-field">
              Zusatzwunsch (optional)
              <input
                className="commerce-input"
                placeholder="wearing light blue jeans and white sneakers"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </label>
            <label className="commerce-field">
              Prompt (das geht an die KI – du kannst ihn frei ändern)
              <textarea
                rows={7}
                className="commerce-input"
                placeholder="Wähle oben eine Vorlage oder schreibe einen eigenen Prompt."
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setPromptEdited(true);
                }}
              />
            </label>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Schutzregeln, die automatisch angehängt werden
              </summary>
              <p className="mt-2">{GARMENT_RULES}</p>
            </details>
            <div className="flex flex-wrap items-end gap-4">
              <label className="commerce-field">
                Format
                <select
                  className="commerce-input"
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value)}
                >
                  {ASPECT_RATIOS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="commerce-field">
                Anzahl Bilder
                <select
                  className="commerce-input"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              {template && promptEdited && (
                <button
                  type="button"
                  className="commerce-button secondary"
                  onClick={() => {
                    setPromptEdited(false);
                    setPrompt(
                      renderTemplate(template, { garment, fit: form.fit, extra }),
                    );
                  }}
                >
                  Prompt aus Vorlage neu erstellen
                </button>
              )}
              <button
                type="button"
                className="commerce-button"
                disabled={
                  !aiReady || Boolean(progress) || prompt.trim().length < 20 || !refs.length
                }
                onClick={makeShots}
              >
                {progress ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                Model-Foto{count > 1 ? "s" : ""} erzeugen
              </button>
            </div>
            {progress && (
              <p role="status" className="text-sm">
                {progress}
              </p>
            )}
          </div>

          {aiPhotos.length > 0 && (
            <div className="commerce-panel space-y-4">
              <h3 className="text-lg">Erzeugte Model-Fotos ({aiPhotos.length})</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {aiPhotos.map((m) => (
                  <figure key={m.id} className="space-y-2">
                    <img
                      src={`${m.url}?w=640`}
                      alt={m.alt}
                      className="aspect-[3/4] w-full bg-secondary object-cover"
                    />
                    <figcaption className="flex gap-3 text-xs">
                      <button
                        type="button"
                        className="underline"
                        disabled={busy === "gallery"}
                        onClick={() => makeHero(m.id)}
                      >
                        Als Titelbild
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-red-400"
                        disabled={busy === "gallery"}
                        onClick={() => removePhoto(m.id)}
                      >
                        <Trash2 size={12} />
                        Löschen
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------------------------------------------------------- 6 Veröffentlichen */}
      {step === 5 && product && !saved && (
        <section className="commerce-panel space-y-5">
          <h2 className="text-xl">Zusammenfassung</h2>
          <ul className="space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.text} className="flex items-center gap-2">
                {c.ok ? (
                  <Check size={14} className="text-emerald-400" />
                ) : (
                  <X size={14} className={c.required ? "text-red-400" : "text-amber-400"} />
                )}
                {c.text}
                {!c.ok && (
                  <span className="text-xs text-muted-foreground">
                    {c.required ? "(nötig zum Veröffentlichen)" : "(empfohlen)"}
                  </span>
                )}
              </li>
            ))}
            <li className="text-muted-foreground">
              {variantCount} Variante{variantCount === 1 ? "" : "n"} werden angelegt.
            </li>
          </ul>
          <fieldset className="space-y-2">
            <legend className="commerce-eyebrow mb-2">Status</legend>
            {(
              [
                ["draft", "Entwurf – nur für dich sichtbar"],
                ["review", "In Prüfung – nur für dich sichtbar"],
                ["published", "Veröffentlicht – im Shop für Kunden sichtbar"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="publication"
                  disabled={value === "published" && !publishable}
                  checked={form.publication === value}
                  onChange={() => setForm({ publication: value })}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className="commerce-button"
            disabled={busy === "save" || !form.title.trim()}
            onClick={save}
          >
            {busy === "save" && <Loader2 className="animate-spin" size={16} />}
            Produkt speichern
          </button>
        </section>
      )}

      {step === 5 && saved && (
        <section className="commerce-panel space-y-4">
          <h2 className="text-xl">Gespeichert</h2>
          <p className="text-sm">
            „{saved.product.title}“ ist als{" "}
            <b>
              {saved.product.publication === "published"
                ? "veröffentlicht"
                : saved.product.publication === "review"
                  ? "in Prüfung"
                  : "Entwurf"}
            </b>{" "}
            gespeichert, mit {saved.product.variants.length} Variante
            {saved.product.variants.length === 1 ? "" : "n"}.
          </p>
          <p className="text-sm">
            Kundenpreis ab:{" "}
            <b>
              {(() => {
                const prices = saved.product.variants
                  .map((v: any) => v.price_cents)
                  .filter((p: unknown) => typeof p === "number");
                return prices.length
                  ? new Intl.NumberFormat("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    }).format(Math.min(...prices) / 100)
                  : "noch kein Preis";
              })()}
            </b>
          </p>
          {saved.warnings.map((w: string) => (
            <p key={w} className="commerce-notice text-sm">
              {w}
            </p>
          ))}
          <div className="flex flex-wrap gap-3">
            <Link
              className="commerce-button"
              href={`/shop/product/${saved.product.id}`}
            >
              Produktseite ansehen
            </Link>
            <Link className="commerce-button secondary" href="/admin/products">
              In der Produktverwaltung öffnen
            </Link>
            <button type="button" className="commerce-button secondary" onClick={reset}>
              Nächstes Produkt
            </button>
          </div>
        </section>
      )}

      {step > 0 && !(step === 5 && saved) && (
        <div className="flex justify-between">
          <button
            type="button"
            className="commerce-button secondary"
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft size={16} /> Zurück
          </button>
          {step < 5 && (
            <button
              type="button"
              className="commerce-button"
              onClick={() => setStep(step + 1)}
            >
              Weiter <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
