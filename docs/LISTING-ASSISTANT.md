# KI-Listing-Assistent

Admins legen unter `/admin/listing` neue Shop-Produkte mit KI-Hilfe an.

## Ablauf (6 Schritte)

1. **Quelle**: Yupoo-Album-Link einfügen, optional den Taobao-/Weidian-Link für Lieferantenaufträge.
   Der Worker (`npm run worker`) liest Titel, Beschreibung, Bilder, Preis (CNY) und Bestelllinks aus.
2. **Bilder**: Daten prüfen, Titelbild wählen, Größentabelle markieren, schlechte Bilder entfernen.
3. **Varianten**: Mehrere Farben ja/nein, Farben, Größen, Merkmale. Die KI schlägt Werte aus den Fotos vor.
4. **Listing**: Die KI schreibt Titel, Kurzbeschreibung, Beschreibung, Highlights, Pflege, Größenhinweis, FAQ und SEO.
5. **Model-Fotos**: Prompt-Vorlagen (Studio, Street, Lifestyle, Editorial, Produkt) plus Referenzfoto gehen an Gemini.
6. **Veröffentlichen**: Checkliste, Status wählen (Entwurf, Prüfung, veröffentlicht), speichern.

## Wichtig

- Das Produkt wird als `draft` angelegt und nicht vom Sortieragenten angefasst (`listing_origin = 'wizard'`).
- Der Bestelllink (`procurement_url`) ist nur für Admins sichtbar. Tracking-Parameter wie `spm` werden entfernt.
- Es werden keine Fakten erfunden: Unbekanntes Material bleibt leer.
- Model-Fotos werden mit `kind = 'ai_model'` gespeichert und im Shop als KI-Bild beschriftet.

## Einrichtung

Siehe `.env.example`:

| Variable | Zweck |
| --- | --- |
| `LISTING_AI_IMAGE_CONSENT=gemini` | Pflicht. Ausdrückliche Erlaubnis, Fotos an Gemini zu senden. |
| `LISTING_AI_API_KEY` / `CATALOG_AGENT_API_KEY` / `GEMINI_API_KEY` | Gemini-Schlüssel (in dieser Reihenfolge gesucht). |
| `LISTING_AI_MODEL` | Textmodell (Standard: `CATALOG_AGENT_MODEL`, sonst `gemini-3.8-flash`). |
| `LISTING_IMAGE_MODEL` | Bildmodell (Standard: `gemini-3-pro-image-preview`, bitte gegen deinen Account prüfen). |

## Stage-Test (5. November 2026)

Getestet auf der Stage (`/opt/fashion-supply-commerce-stage`, Image `fashion-supply:listing-assistant-20261105d`)
mit dem Album `swagsupply.x.yupoo.com/albums/218151159`:

- Import (9 Bilder), Bestelllink ohne `spm`, KI-Analyse, KI-Texte und Speichern als Entwurf funktionieren.
- Model-Fotos: Der Schlüssel hat kein Bild-Kontingent (HTTP 429 bei allen Bildmodellen). Dafür muss im Google-Projekt Abrechnung aktiv sein.
- Rollback der Stage: `bash .stage-listing-deploy.sh fashion-supply:catalog-agent-new-only-20261104-fonts`
  (Migration 008 fügt nur Spalten hinzu, das alte Image läuft damit weiter).
- Produktion wurde nicht verändert.

## Code

- Backend: `src/lib/commerce/listing.ts`, `listing-ai.ts`, `listing-templates.ts`, `migrations/008_ai_listing.sql`
- Frontend: `src/components/listing/wizard.tsx`, `src/app/admin/listing/page.tsx`
- Tests: `npm run test:listing` und der Subtest "AI listing wizard" in `test/commerce.test.ts`

## Bekannte Grenzen

- Einzelne Bilder sind noch nicht einer Farbe zugeordnet.
- Gelöschte Bilder bleiben als Datei im Storage liegen.
