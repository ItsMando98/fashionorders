-- KI-Listing-Assistent.
-- listing: öffentliche Zusatzinhalte der Produktseite (Kurzbeschreibung, Highlights, Pflege, Größenhinweis, FAQ, SEO, Farbmuster).
--          Enthält bewusst KEINE internen Daten; der Inhalt wird 1:1 an Kunden ausgeliefert.
-- listing_origin: 'wizard' = vom Admin im Assistenten geprüft und gepflegt. Der Sortieragent fasst solche Produkte nicht an.
ALTER TABLE products ADD COLUMN IF NOT EXISTS listing jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS listing_origin text NOT NULL DEFAULT '';
