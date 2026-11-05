CREATE TABLE shop_suppliers (
 id serial PRIMARY KEY, name text NOT NULL UNIQUE, contact text NOT NULL DEFAULT '',
 channel text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true
);
REVOKE ALL ON shop_suppliers FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON shop_suppliers FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON shop_suppliers FROM authenticated; END IF;
END $$;
INSERT INTO shop_suppliers(name) SELECT DISTINCT seller FROM products WHERE seller IS NOT NULL AND trim(seller)<>'' ON CONFLICT DO NOTHING;
