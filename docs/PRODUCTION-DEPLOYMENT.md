# Produktionsdeployment – 4. November 2026

Produktiv: https://fashion-supply.store

- Verzeichnis `/opt/fashion-supply`; bestehendes Supabase im Netzwerk `supabase_default`.
- App und Worker: `fashion-supply:catalog-agent-new-only-20261104-fonts` (ergänzter Textumbruch für lange importierte Titel).
- Scraper: `fashion-supply-scraper:commerce-20261104T192816Z`.
- Alle sieben versionierten Migrationen angewendet. App und Worker verwenden `fashion_shop_app`, ohne Superuser- oder Schema-CREATE-Rechte. Die separate Migrationsrolle besitzt die Anwendungstabellen.
- `anon` kann `users` nicht lesen; `authenticated` kann `shop_orders` nicht lesen.
- 824 ursprüngliche Katalogartikel, 48 persönliche Artikel, 3 Konten und 12 Fashiongram-Beiträge erhalten. Die neuen Produktentitäten umfassen zusätzlich 48 private Zuordnungen; historische Zahlungen wurden nicht erfunden.
- 736 Bildreferenzen vollständig in die Produktions-Buckets übernommen. Originaldateien bleiben erhalten. Responsive WebP-Auslieferung und fremder privater Bildzugriff geprüft.

## Sicherung und Wiederherstellungsprobe

Rootgeschützte Sicherung: `/opt/fashion-supply/backups/release-20261104T192816Z`.

Enthält Datenbank, Rollen, Anwendung/Konfiguration, lokale Medien und Supabase Storage. `cutover.dump` und `cutover-media.tar.gz` sind die endgültigen Sicherungen nach Anhalten der bisherigen App. SHA-256-Prüfsummen liegen bei. Die initiale Sicherung wurde erfolgreich in einem separaten PostgreSQL-17-Container wiederhergestellt; alle Migrationen und eine wiederholte Datenübernahme wurden darauf geprüft. Der temporäre Prüfcontainer wurde anschließend entfernt.

Vorherige Images sind als `fashion-supply:before-commerce-20261104T192816Z` und `fashion-supply-scraper:before-commerce-20261104T192816Z` erhalten. Ein Rückbau nach neuen realen Bestellungen darf diese Bestellungen nicht überschreiben.

## Verwaltung

```sh
cd /opt/fashion-supply
docker compose --env-file .env --env-file .env.commerce \
  -f docker-compose.yml -f docker-compose.commerce.yml ps
```

Die rootgeschützten Dateien `.env.commerce`, `.env.commerce-provision` und `.env.commerce-migrations` enthalten getrennte Laufzeit-/Provisionierungs-/Migrationskonfiguration. Provisionierungs- und Migrationszugänge gehören nicht in App- oder Worker-Container. Die `.dockerignore` schließt diese Dateien aus.

Die Produktionsrolle `postgres` ist kein Superuser. Die Provisionierung berücksichtigt die PostgreSQL-17-Anforderung, dem administrativen Aufrufer INHERIT/SET-Mitgliedschaft in der neu erstellten Migrationsrolle zu geben. Diese Deployment-Kompatibilitätskorrektur ist im Release enthalten.

## Durchgeführte Live-Prüfungen

- HTTPS, Health-Endpoint und nicht angemeldeter API-Zugriff.
- Angemeldete Shop-Ansicht, Admin-Produkteditor und mobile Filter ohne Browserfehler/Überlauf.
- Private optimierte WebP-Bilder; fremder Eigentümer erhält 404, Nicht-Admin erhält 403 im Backend.
- Produktiver Scraper: erste Collection-Seite mit 120 Alben, Beispielalbum mit 31 eindeutigen Bildern und korrektem Taobao-Bestelllink.
- Die vollständige Collection mit 894 eindeutigen Alben wurde zuvor im gleichen getesteten Release im Staging gelesen.
- Kurzlebige Prüf-Sessions wurden anschließend entfernt; keine Testkonten, Bestellungen, Zahlungen oder Lieferantennachrichten angelegt.

## Noch im Admin einzutragen

Betreiber-/Steuerangaben, erlaubte Lieferländer und verifizierte BTC-/USDC-Wallet-Adressen. Keine Zahlungsart ist aktiviert. 642 aktive übernommene Katalogartikel mit Bild und Variante sind nach der Sichtbarkeitskorrektur veröffentlicht. Fehlende Bilder und erkennbare Informations-/Anleitungsalben bleiben ausgeschlossen. Preis- und Lieferbarkeitsprüfung bleibt bestehen; die 48 persönlichen Importe bleiben privat. Die vorherigen Freigabestände sind als `catalog-publication-before.json` in der Releasesicherung dokumentiert.

## Katalogbereinigung und Shop-Update

Die zuvor sichtbaren alten Artikel wurden auf Betreiberwunsch archiviert. Der leere Shop ist jetzt beabsichtigt. Neue Katalogprodukte werden durch den [Sortieragenten](CATALOG-AGENT.md) geprüft; persönliche Importe bleiben ausgeschlossen. Aktueller Build ergänzt Sidebar, 48 kleinere Kacheln, Scroll-Rücksetzung und persistenten Bildcache. Eine frische Sicherung vor Migration 007 liegt unter `backups/catalog-agent-*`. Frühere Bestandszahlen in diesem Dokument beschreiben den ursprünglichen Migrationsstand; aktive Nutzerimporte können den Bestand inzwischen erhöht haben.
