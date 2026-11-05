-- Keep the image/catalog source separate from the actual supplier item URL.
ALTER TABLE products ADD COLUMN procurement_url text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN procurement_links jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shop_order_items ADD COLUMN procurement_url text NOT NULL DEFAULT '';
-- Existing order snapshots are deliberately not rewritten.
ALTER TABLE shop_purchase_items ADD COLUMN procurement_url text NOT NULL DEFAULT '';
