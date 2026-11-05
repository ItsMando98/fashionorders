# Implementierungs- und Prüfstatus

Stand: 4. November 2026. Zahlungsarten nach Betreiberentscheidung: ausschließlich BTC/Bitcoin und USDC/Ethereum ERC-20. Frühere ETH-/USDT-Einträge bleiben historische Datensätze und sind nicht aktivierbar.

## Bereitgestellte Funktionen

- Dunkler Shop mit Anmeldung, hierarchischen Kategorien, URL-Filtern, Preissortierung, Varianten und Galerien.
- Private Einzel-/Mehrfachimporte als dauerhafte Jobs, Wiederholungen, Sammlungen, ausdrückliche Freigaben und geschützte Medien.
- Gemeinsame Bestellanfrage für Shop-Produkte und persönliche Importe; serverseitige Preise und gegen Wiederholungen abgesicherte Verarbeitung.
- Versionierte Angebote mit 48 Stunden Gültigkeit, Kundenannahme und unveränderlichem Kaufstand.
- Automatische Coinbase-EUR-Umrechnung für BTC/Bitcoin und USDC/Ethereum ERC-20; 15 Minuten gültige Zahlungsanforderungen, QR-Codes und manuelle Zahlungsprüfung.
- Interne Lieferanten-/Gebührenverwaltung, Bestelltexte und Excel-Exporte, dokumentierte Übergaben, mehrere Sendungen und Erstattungsprotokoll.
- Sechs versionierte Schema-Migrationen, Daten-/Medienmigrationen, getrennte Datenbankrollen und backendinterne Zugriffsrechte.
- Bestehende Artikel, ursprüngliche Finanzdaten und Fashiongram-Referenzen bleiben erhalten. Historische Einreichungen werden nicht als bezahlt neu angelegt.

## Tatsächlich durchgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript | Erfolgreich |
| Next.js-Produktionsbuild | Erfolgreich |
| Node-/PostgreSQL-Suite | 26 Tests bestanden; getrennte lokale Commerce- und Auth-Datenbanken |
| Python-Scraper-Verträge | 8 Tests bestanden (lokal); Live-Scraper im isolierten VPS-Staging ebenfalls geprüft |
| UI-Review | 0 verbleibende Hinweise im geprüften Shop-/Konto-/Komponentenbereich |
| Lokaler Browser | 1440×1000 und 390×844; Galerie, Varianten, Warenkorb, Anfrage, Angebot, Annahme, Zahlungswahl und Filter geprüft; keine relevanten Browserfehler |
| VPS-Browser | Produktions-Cookie-Anmeldung, Admin-Produkteditor, Shop und mobile Filter geprüft; zusätzlich WebP-Auslieferung in 240/640/1600-Größen, responsive Bildquellen, privater Zugriffsschutz und mobile Produktseite ohne Überlauf oder Browserfehler |
| Coinbase-Konnektivität | BTC- und USDC-EUR-Spotpreise tatsächlich erreichbar |
| VPS-Datenbank-Restore | 824 ursprüngliche Katalogprodukte, 48 persönliche Artikel, 12 Fashiongram-Posts wiederhergestellt |
| Migrationswiederholung | Erfolgreich; 48 persönliche Artikel eindeutig zugeordnet, keine historischen Zahlungen erfunden |
| Medien-Restore | Sicherung in ein separates Staging-Verzeichnis zurückgespielt |
| Supabase Storage | Upload, signierter Abruf und Download mit tatsächlichen Staging-Buckets geprüft |
| Staging-Pilot | Ausdrücklich markierte Galerie-Fixture mit 3 wiederhergestellten Bildern → gemischter Warenkorb → Angebot → Annahme → echter Coinbase-Kurs → synthetische Zahlungsprüfung → 2 Lieferantenexports → 2 Sendungen → abgeschlossen |

Die Staging-Zahlungs- und Lieferantenereignisse sind Simulationen. Es wurden keine Gelder übertragen und keine Nachrichten an Lieferanten geschickt.

## Collection- und Bestelllink-Erweiterung

Der Import erkennt Collection-/Kategorie-Seiten und zerlegt sie vollständig in private Albumjobs mit dauerhaften Folgeaufträgen pro Seite. Pro Produkt werden Yupoo-Bildquelle und interner Taobao-/Weidian-Bestelllink getrennt gespeichert. Mehrdeutige Links bleiben zur Admin-Auswahl offen; manuelle Auswahl bleibt bei erneutem Scraping erhalten. Lieferantenaufträge frieren den Bestelllink pro Position ein; Text-/Excel-Exporte enthalten ihn. Details: [Scraper-Verhalten und Grenzen](INTELLIGENT-SCRAPER.md).

## Vollständige Collections und Webbilder

Die Beispiel-Collection wurde ohne Produkt-/Seitenlimit vollständig gelesen: 894 eindeutige Album-URLs über acht belegte Seiten, danach eine leere Seite. Es wurden dabei keine 894 Lieferantenaufträge oder Produktkäufe ausgelöst.

Ein echtes Lieferantenbild mit 57.115 Bytes wurde im privaten Staging-Storage als WebP mit 20.982 Bytes gespeichert; die Varianten benötigen 16.008 Bytes (640 Pixel) bzw. 5.026 Bytes (240 Pixel). Ausrichtung, Größen, Format und entfernte Metadaten sind zusätzlich mit echten Bilddateien getestet. Neue Uploads werden vor der Speicherung optimiert; bestehende unoptimierte Shopbilder beim berechtigten Abruf.

## Externer Live-Import

Am 4. November 2026 wurde die vom Betreiber bereitgestellte Collection `https://aa800000000000.x.yupoo.com/collections/4580705` mit dem echten Python-Scraper gelesen: 120 Albumlinks auf der ersten Seite, darunter Album `242011575` (Titel `8731-106-148`). Nach Zusammenführung von Original-/Vorschaubild-URLs wurden genau 31 eindeutige Bildquellen erkannt. Das Album liefert den kanonischen Bestelllink `https://item.taobao.com/item.htm?id=1058102530419` sowie die belegten Hinweise M/L/XL und 黑/咖啡/紫色.

Ein vollständiger privater Import dieses Albums wurde anschließend über die Staging-API und den dauerhaften Worker ausgeführt. Beim ersten Durchlauf wurden 11 von 20 erkannten Quellbildern im privaten Storage gespeichert. Der Admin-Editor zeigte den korrekten getrennten Bestelllink; keine Browserfehler. Die aktuelle Version besitzt keine Galerie-Mengenquote, optimiert neue Bilder automatisch als WebP mit responsiven Größen und weist ausdrücklich auf unvollständig übernommene Bilder hin. Ein erkannter Link und eine importierte Galerie sind keine Lieferbarkeitsbestätigung.

Das ältere Happywhale-Album bleibt nicht erreichbar (HTTP 404). Solche Fehler erzeugen weiterhin einen Importfehler anstelle synthetischer Produktdaten.

## Staging und Produktion

- Staging-Verzeichnis: `/opt/fashion-supply-commerce-stage`.
- Isolierte Staging-Datenbank: `fashion-shop-stage-db17`, ohne öffentlichen Datenbankport.
- App/Worker: `fashion-commerce-stage-app`, `fashion-commerce-stage-worker`; Image `fashion-supply:catalog-agent-new-only-20261104-fonts`.
- Eigener Galerie-Scraper: `fashion-commerce-stage-scraper`.
- Eigene Storage-Buckets: `fashion-private-stage`, `fashion-catalog-stage`.
- Wiederhergestellte Medienkopie unter `restore-media/data`; keine Schreibzugriffe auf die ursprünglichen Medien.
- App bindet ausschließlich an VPS-Loopback `127.0.0.1:3017`; lokaler SSH-Tunnel öffnet die Vorschau unter `http://localhost:3017/shop`.
- Datenbank- und Mediensicherung unter `/opt/fashion-supply/backups/commerce-20261104`, nur für root zugänglich.
- Produktion ist seit dem 4. November 2026 auf das geprüfte Commerce-Release umgeschaltet: App, Worker und Scraper unter `/opt/fashion-supply`, sieben Migrationen auf dem bestehenden Supabase. Die Zugriffssperren für `anon`/`authenticated` sind wirksam geprüft.
- Release und Sicherung: [Produktionsdeployment](PRODUCTION-DEPLOYMENT.md).

## Katalogsichtbarkeit

Die bisherigen Katalogartikel wurden auf ausdrücklichen Betreiberwunsch archiviert. Der Shop bleibt bis zu neuen geprüften Produkten leer. Persönliche Importe wurden nicht entfernt. Der visuelle Sortieragent arbeitet ausschließlich auf neuen Katalogprodukten oberhalb der festgelegten ID-Grenzen; alte Katalogbilder werden nicht an den Modellanbieter übertragen. Details: [Katalogagent](CATALOG-AGENT.md).

Shop: shadcn-Sidebar, kompaktere Kacheln, 48 Artikel pro Seite und Rückkehr zum Seitenanfang beim Blättern. Responsive WebP-Dateien werden persistent zwischengespeichert und über ETags erneut verwendet.
## Noch erforderliche Betriebskonfiguration

1. Tatsächliche Betreiber- und Preis-/Steuerangaben, erlaubte Lieferländer und verifizierte Wallet-/Netzwerkkonfiguration eintragen.
2. Fehlende Bilder und Varianten der Importentwürfe prüfen; der externe Mehrbild-Import wurde mit dem Betreiberbeispiel im Staging nachgewiesen.
3. Katalogentwürfe redaktionell prüfen. Historische Foto-Produkte können nach bestätigter gemeinsamer Produktidentität zu einer Galerie zusammengeführt werden; Sammelalben dürfen nicht pauschal als ein Kaufartikel veröffentlicht werden.
4. Die Produktionsumschaltung ist abgeschlossen. Vor Änderungen mit neuen realen Bestellungen den [Rollout-/Recovery-Ablauf](COMMERCE-ROLLOUT.md) beachten; keine alte Sicherung über neue Bestellungen zurückspielen.

## Wartungshinweise

Die neuen Commerce-Servermodule verwenden einen eigenen postgres-js-Client. Der bestehende Drizzle-Treiber verändert JSON-Serializer seines Clients; dieser Client darf nicht ungeprüft für die neuen `sql.json(...)`-Abfragen wiederverwendet werden.

E-Mail-Versand, automatischer Lieferantenversand und automatische Blockchain-Zahlungsbestätigung sind nicht aktiviert. Auftragshistorie und Benachrichtigungsjobs dienen zunächst der Anzeige im Backend/Konto. Die ursprüngliche Analyse bleibt als historischer Plan erhalten; maßgeblich für den aktuellen Stand sind dieses Dokument und der Rollout-Ablauf.
