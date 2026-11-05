ALTER TABLE shop_jobs DROP CONSTRAINT shop_jobs_kind_check;
ALTER TABLE shop_jobs ADD CONSTRAINT shop_jobs_kind_check CHECK(kind IN ('import','notify','source','catalog_audit','media_warm'));
CREATE TABLE shop_catalog_audits (
 id serial PRIMARY KEY, actor_id integer NOT NULL REFERENCES users(id), source_album text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed','applied','reverted')),
 input jsonb NOT NULL, result jsonb, before_state jsonb, model text NOT NULL DEFAULT '', error text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),applied_at timestamptz
);
CREATE TABLE shop_product_aliases (
 source_product_id integer PRIMARY KEY REFERENCES products(id),target_product_id integer NOT NULL REFERENCES products(id),
 audit_id integer NOT NULL REFERENCES shop_catalog_audits(id),CHECK(source_product_id<>target_product_id)
);
REVOKE ALL ON shop_catalog_audits,shop_product_aliases FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON shop_catalog_audits,shop_product_aliases FROM %I',r); END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fashion_shop_app') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON shop_catalog_audits,shop_product_aliases TO fashion_shop_app;
  GRANT USAGE,SELECT ON SEQUENCE shop_catalog_audits_id_seq TO fashion_shop_app;
 END IF;
END $$;
