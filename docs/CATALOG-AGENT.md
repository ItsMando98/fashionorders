# Katalogprüfung für neue Produkte

Stand: 4. November 2026. Die bisherigen Katalogprodukte wurden auf Betreiberwunsch archiviert. Sie werden weder erneut veröffentlicht noch zur visuellen Analyse übertragen. Persönliche Importe, Bestellungen und Kundendaten sind ausgeschlossen.

Der Sortieragent verwendet `@openai/agents` mit dem serverseitigen Google-Gemini-Kompatibilitätsadapter. Tracing ist deaktiviert. Voraussetzung sind ein konfigurierter Schlüssel, eine explizite providerbezogene Bildfreigabe und gespeicherte ID-Grenzen. Produktion: Produkt-ID größer 898, Medien-ID größer 736; Staging: größer 910/762. Diese Grenzen sind dauerhaft und dürfen beim Neustart nicht neu berechnet werden. Übernommene Legacy-Katalogeinträge bleiben zusätzlich ausgeschlossen.

Neue Shop-Importe und neu hinzugefügte Katalogmedien erzeugen dauerhafte Prüfjobs. Der Agent betrachtet die vollständige Galerie in beschrifteten Bildgruppen. Detailbilder, Größentabellen, Verpackungen, Lagerübersichten und Kontaktbilder sind keine eigenständigen Kaufartikel. Nur eindeutig passende Ansichten werden zusammengeführt. Bestätigte Produkte erhalten ein geeignetes Titelbild; unsichere Ergebnisse bleiben in Prüfung. Manuell gepflegte Felder werden geschützt. Preis und Lieferbarkeit werden nicht erfunden.

Im Backend unter `/admin/catalog-agent` sind Ergebnisse, Gründe und Jobstatus sichtbar. Anwendungen werden protokolliert und können bei unverändertem Datenstand zurückgenommen werden. Ausgeblendete Dubletten erhalten eine Weiterleitung zum verbleibenden Produkt. Es gibt keine physische Massenlöschung.

Produktionsmodell: `gemini-3-flash-preview`, über `CATALOG_AGENT_MODEL` änderbar. Zahlungs- oder Lieferantenaktionen gehören nicht zu den Fähigkeiten des Agenten. Modellfehler werden als fehlgeschlagene bzw. wiederholbare Jobs behandelt; sie rechtfertigen keine ungeprüfte Veröffentlichung.

Bilder werden als responsive WebP-Dateien gespeichert. Der Server hält zusätzlich einen persistenten Varianten-Cache. Vor jedem Bildzugriff und jeder ETag-Antwort erfolgt die Berechtigungsprüfung; private Medien erhalten keinen öffentlichen Browsercache.

Validierung: 31 automatisierte Tests, SDK-Texttest und visueller SDK-Test ausschließlich mit einem neu generierten roten Quadrat. Browserprüfungen verwenden temporär simulierte Kacheln; es werden keine Testprodukte im Live-Shop veröffentlicht. Eine fachliche Qualitätsbewertung realer neuer Produktimporte erfolgt erst, wenn solche Importe vorliegen.
