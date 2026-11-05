-- The app authenticates with its own cookie sessions, not PostgREST JWT roles.
-- Social/profile data shares the same backend-only access boundary as commerce.
DO $$ DECLARE t text; r text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'shop_%' OR tablename LIKE 'gram_%' OR tablename IN ('users','sessions','items','products','cart_items','orders','order_items','settings','login_codes','order_shares','scrape_sources')) LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',t,r); END IF;
  END LOOP;
 END LOOP;
END $$;
