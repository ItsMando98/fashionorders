# Vollständige Collection-Importe und optimierte Webbilder

## Collections und Produktalben

Der Import erkennt Yupoo-Collections (`/collections/:id`, `/categories/:id`) und Produktalben (`/albums/:id`). Collections werden vollständig Seite für Seite gelesen. Es gibt keine Mengenquoten für Eingabelinks, offene Importe, Produkte, Seiten oder Galeriebilder. Ein Album bleibt ein Produkt mit Galerie.

Jede Collection-Seite läuft als dauerhafter Auftrag. Entdeckte Album-IDs, Produktaufträge und der Folgeauftrag werden in einer Transaktion gespeichert. Ein Absturz kann die Verarbeitung nicht zwischen diesen Schritten unterbrechen. Wiederholte oder leere Seiten beenden den Lauf. Kontakt-/Infoalben werden nicht als Produkte eingereiht, verhindern aber auch nicht die Verarbeitung der nächsten Seite. Deduplizierung erfolgt pro Importlauf; private und globale Importe bleiben getrennt.

Der Importfortschritt enthält die bisher entdeckte Gesamtzahl; das gespeicherte Ergebnis kennzeichnet auch den Abschluss der Seitensuche. Auch automatische Admin-Quellen verwenden die vollständige Verarbeitung; frühere `per_run_limit`-Werte werden im neuen Worker nicht mehr als Mengenlimit verwendet.

## Webbilder

Neue Bilder werden vor dem Upload automatisch mit Sharp verarbeitet:

- EXIF-Ausrichtung anwenden, Metadaten entfernen.
- Seitenverhältnis erhalten; kleine Bilder nicht hochskalieren.
- WebP, Qualität 82, längste Kante höchstens 1600 Pixel.
- Gespeicherte Varianten mit 640 und 240 Pixeln für Kacheln und Vorschaubilder.
- Inhaltsbasierte Dateinamen unter `web-v1`; keine Überschreibung alter Medienreferenzen.

Kacheln verwenden responsive Bildquellen, Galerie-Vorschaubilder die kleine Variante. Bestehende unoptimierte Bilder werden beim berechtigten Abruf ebenfalls als passendes WebP ausgegeben. Private Bilder bleiben durch die Zugriffsprüfung geschützt. Fehlgeschlagene Bildübernahmen erscheinen ausdrücklich im Importergebnis. Excel-Exporte erhalten eingebettete PNG-Vorschauen, auch wenn die gespeicherte Quelle WebP ist.

Es gibt keine Galerie-Mengenquote. Zeit-, Speicher- und Decodergrenzen begrenzen einzelne technische Operationen; ein Quellenfehler wird nicht als erfolgreich importiertes Produkt ausgegeben.

## Interner Bestelllink

Yupoo bleibt die Bild-/Produktquelle. Konkrete Taobao-/Weidian-Artikel aus der Albumbeschreibung werden getrennt gespeichert. Yupoo-Weiterleitungen werden entpackt und Trackingparameter entfernt.

Ein eindeutiger Kandidat wird übernommen. Fehlende oder mehrere Kandidaten erfordern eine Admin-Prüfung. Manuelle Bestelllinks bleiben beim erneuten Scraping erhalten. Kunden-DTOs enthalten weder Bestelllink noch Kandidatenliste. Lieferantenaufträge frieren den Bestelllink pro Position ein; Text-/Excel-Exporte enthalten ihn neben der Bildquelle.

Migrationen: `005_procurement_links.sql` und `006_collection_pages.sql`. Produktionsumschaltung weiterhin gemäß `COMMERCE-ROLLOUT.md`.
