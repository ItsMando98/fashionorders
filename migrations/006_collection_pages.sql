-- Durable traversal: each page commits discovered album identities and its continuation atomically.
CREATE TABLE shop_import_albums (
 root_job_id integer NOT NULL REFERENCES shop_jobs(id) ON DELETE CASCADE,
 album_url text NOT NULL,
 is_product boolean NOT NULL DEFAULT true,
 PRIMARY KEY(root_job_id,album_url)
);
REVOKE ALL ON shop_import_albums FROM PUBLIC;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
   EXECUTE format('REVOKE ALL ON shop_import_albums FROM %I',api_role);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fashion_shop_app') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON shop_import_albums TO fashion_shop_app;
 END IF;
END $$;
