-- Additive migration; existing items, orders and Fashiongram references remain intact.
ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id integer REFERENCES users(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'catalog' CHECK (visibility IN ('catalog','private'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS publication text NOT NULL DEFAULT 'draft' CHECK (publication IN ('draft','review','published','archived'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS material text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS fit text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manual_fields jsonb NOT NULL DEFAULT '[]';
DROP INDEX IF EXISTS products_source_url_unique;
CREATE UNIQUE INDEX IF NOT EXISTS products_catalog_source_unique ON products(source_url) WHERE source_url <> '' AND visibility='catalog';
CREATE UNIQUE INDEX IF NOT EXISTS products_private_source_unique ON products(owner_user_id,source_url) WHERE visibility='private' AND source_url <> '';
CREATE TABLE IF NOT EXISTS shop_categories (id text PRIMARY KEY, parent_id text REFERENCES shop_categories(id), label text NOT NULL);
CREATE TABLE IF NOT EXISTS shop_product_categories (product_id integer REFERENCES products(id) ON DELETE CASCADE, category_id text REFERENCES shop_categories(id), PRIMARY KEY(product_id,category_id));
CREATE TABLE IF NOT EXISTS shop_variants (
 id serial PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 size text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '', sku text NOT NULL DEFAULT '',
 availability text NOT NULL DEFAULT 'review' CHECK(availability IN ('review','available','unavailable')),
 purchase_fen bigint CHECK(purchase_fen > 0), price_approved boolean NOT NULL DEFAULT false,
 UNIQUE(product_id,size,color)
);
CREATE TABLE IF NOT EXISTS shop_media (
 id serial PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 variant_id integer REFERENCES shop_variants(id), object_path text NOT NULL, bucket text NOT NULL,
 alt text NOT NULL DEFAULT '', position integer NOT NULL DEFAULT 0, kind text NOT NULL DEFAULT 'product',
 UNIQUE(product_id,bucket,object_path)
);
CREATE TABLE IF NOT EXISTS shop_collections (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS shop_saved (user_id integer REFERENCES users(id), product_id integer REFERENCES products(id) ON DELETE CASCADE, notes text NOT NULL DEFAULT '', PRIMARY KEY(user_id,product_id));
CREATE TABLE IF NOT EXISTS shop_collection_items (collection_id integer REFERENCES shop_collections(id) ON DELETE CASCADE, product_id integer REFERENCES products(id) ON DELETE CASCADE, PRIMARY KEY(collection_id,product_id));
CREATE TABLE IF NOT EXISTS shop_addresses (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), label text NOT NULL, address jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS shop_cart_versions (user_id integer PRIMARY KEY REFERENCES users(id), version integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS shop_cart (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), variant_id integer NOT NULL REFERENCES shop_variants(id), quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99), UNIQUE(user_id,variant_id));
CREATE TABLE IF NOT EXISTS shop_orders (
 id serial PRIMARY KEY, number text NOT NULL UNIQUE, user_id integer NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'review' CHECK(status IN ('review','offered','confirmed','procurement','completed','cancelled')),
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','review','confirmed','partially_refunded','refunded')),
 address jsonb NOT NULL, idempotency_key text NOT NULL, request_hash text NOT NULL,
 accepted_offer_id integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS shop_order_items (
 id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES shop_orders(id), product_id integer REFERENCES products(id), variant_id integer REFERENCES shop_variants(id),
 title text NOT NULL, size text NOT NULL, color text NOT NULL, sku text NOT NULL,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99), supplier text NOT NULL DEFAULT '', source_url text NOT NULL DEFAULT '',
 purchase_fen bigint, requested_cents bigint, notes text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS shop_offers (
 id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES shop_orders(id), version integer NOT NULL,
 lines jsonb NOT NULL, shipping_cents bigint NOT NULL CHECK(shipping_cents>=0), total_cents bigint NOT NULL CHECK(total_cents>0),
 cny_to_eur numeric(20,10) NOT NULL CHECK(cny_to_eur>0), delivery_note text NOT NULL,
 expires_at timestamptz NOT NULL, accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,version)
);
ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS shop_orders_accepted_offer_id_fkey;
ALTER TABLE shop_orders ADD CONSTRAINT shop_orders_accepted_offer_id_fkey FOREIGN KEY (accepted_offer_id) REFERENCES shop_offers(id);
CREATE TABLE IF NOT EXISTS shop_payment_methods (
 id serial PRIMARY KEY, currency text NOT NULL CHECK(currency IN ('BTC','ETH','USDT')), network text NOT NULL,
 address text NOT NULL, token_contract text NOT NULL DEFAULT '', decimals integer NOT NULL CHECK(decimals BETWEEN 0 AND 18), enabled boolean NOT NULL DEFAULT false,
 UNIQUE(currency,network)
);
CREATE TABLE IF NOT EXISTS shop_payment_requests (
 id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES shop_orders(id), method_id integer REFERENCES shop_payment_methods(id),
 currency text NOT NULL, network text NOT NULL, address text NOT NULL, token_contract text NOT NULL DEFAULT '', decimals integer NOT NULL,
 amount_atoms numeric(78,0) NOT NULL CHECK(amount_atoms>0), rate_eur numeric(30,12) NOT NULL CHECK(rate_eur>0), total_cents bigint NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted','confirmed','exception','expired')),
 txid text, actual_atoms numeric(78,0), exception text NOT NULL DEFAULT '', expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(network,txid)
);
CREATE TABLE IF NOT EXISTS shop_purchase_orders (
 id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES shop_orders(id), supplier text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','confirmed','unavailable','cancelled')),
 external_reference text NOT NULL DEFAULT '', recipient text NOT NULL DEFAULT '', sent_at timestamptz, confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shop_purchase_items (
 id serial PRIMARY KEY, purchase_order_id integer NOT NULL REFERENCES shop_purchase_orders(id), order_item_id integer NOT NULL REFERENCES shop_order_items(id),
 quantity integer NOT NULL CHECK(quantity>0), purchase_fen bigint NOT NULL CHECK(purchase_fen>0)
);
CREATE TABLE IF NOT EXISTS shop_shipments (
 id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES shop_orders(id), purchase_order_id integer NOT NULL REFERENCES shop_purchase_orders(id),
 carrier text NOT NULL, tracking text NOT NULL, status text NOT NULL DEFAULT 'shipped' CHECK(status IN ('shipped','delivered')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shop_shipment_items (shipment_id integer REFERENCES shop_shipments(id), purchase_item_id integer REFERENCES shop_purchase_items(id), quantity integer NOT NULL CHECK(quantity>0), PRIMARY KEY(shipment_id,purchase_item_id));
CREATE TABLE IF NOT EXISTS shop_events (id serial PRIMARY KEY, order_id integer REFERENCES shop_orders(id), actor_id integer REFERENCES users(id), type text NOT NULL, data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS shop_jobs (
 id serial PRIMARY KEY, user_id integer REFERENCES users(id), kind text NOT NULL CHECK(kind IN ('import','notify','source')),
 payload jsonb NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, token uuid,
 result jsonb, error text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_jobs_claim_idx ON shop_jobs(status,available_at,lease_until);
CREATE INDEX IF NOT EXISTS shop_orders_owner_idx ON shop_orders(user_id,id);
CREATE INDEX IF NOT EXISTS shop_variants_product_idx ON shop_variants(product_id);
CREATE TABLE IF NOT EXISTS shop_legacy_mappings (kind text NOT NULL, legacy_id integer NOT NULL, new_id integer, detail jsonb NOT NULL DEFAULT '{}', PRIMARY KEY(kind,legacy_id));
-- No app data is exposed via PostgREST. Custom cookie sessions authenticate Next.js only.
DO $$ DECLARE r text; t text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'shop_%' OR tablename IN ('users','sessions','items','products','cart_items','orders','order_items','settings','login_codes','order_shares','scrape_sources')) LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',t,r);
   END LOOP;
  END IF;
 END LOOP;
END $$;
-- Prevent inherited PUBLIC privileges from bypassing explicit API-role revocations.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'shop_%' OR tablename IN ('users','sessions','items','products','cart_items','orders','order_items','settings','login_codes','order_shares','scrape_sources')) LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
 END LOOP;
END $$;
ALTER TABLE shop_variants ADD COLUMN IF NOT EXISTS fee_fixed_cents bigint CHECK(fee_fixed_cents>=0);
ALTER TABLE shop_variants ADD COLUMN IF NOT EXISTS fee_percent numeric(12,4) CHECK(fee_percent>=0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_original text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS shop_collection_shares (
 collection_id integer NOT NULL REFERENCES shop_collections(id) ON DELETE CASCADE,
 user_id integer NOT NULL REFERENCES users(id), PRIMARY KEY(collection_id,user_id)
);
REVOKE ALL ON TABLE shop_collection_shares FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE shop_collection_shares FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE shop_collection_shares FROM authenticated; END IF;
END $$;
CREATE INDEX IF NOT EXISTS products_visibility_idx ON products(visibility,publication,owner_user_id,id);
CREATE INDEX IF NOT EXISTS shop_media_product_idx ON shop_media(product_id,position);
