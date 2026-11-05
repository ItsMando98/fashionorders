# Commerce rollout and recovery

The new UI and API are implemented behind `SHOP_V2_ENABLED=1`. Keep the existing production image until all gates below pass. PostgreSQL remains the existing self-hosted Supabase on the VPS. No Supabase Auth migration is performed.

## Configuration

- Runtime: `SHOP_DATABASE_URL` using `fashion_shop_app`, `SCHEMA_MANAGED=1`, `SHOP_V2_ENABLED=1`.
- Migrations: `MIGRATION_DATABASE_URL` using an administrative owner initially, then `fashion_shop_migrator`. Never put this credential in app/worker containers.
- Media: `SUPABASE_INTERNAL_URL` pointing to the internal Supabase gateway, server-only `SUPABASE_SERVICE_ROLE_KEY`. Never use a public/browser-prefixed variable.
- `APP_PUBLIC_URL`: canonical HTTPS URL of the shop.
- Existing `SCRAPER_SIDECAR_URL`, `SCRAPER_TOKEN`, optional `GEMINI_API_KEY` and configurable `GEMINI_MODEL` remain server-only.
- In Admin → Shop-Einstellungen, enter actual operator/tax copy, permitted country codes, internal pricing parameters and verified crypto wallets/networks. These are operator data, not invented defaults. Offer issuance is blocked until operator and tax copy exist.
- BTC uses Bitcoin and USDC uses Ethereum ERC-20 in this release. ETH and USDT cannot be enabled; historical payment records are retained. Other USDC networks are not inferred from an existing wallet address. Enabling a payment method validates its EUR spot-price pair. Actual chain transfers and refunds are performed outside the app and manually reconciled inside the app.

## Staging and backup gates

1. Capture the current container image identifiers, database backup and media backup under a dated root-only backup directory. Stop legacy import scheduling for the cutover window.
2. Restore a public-schema backup to an isolated staging database; never run test resets against production. Preserve `items`, `orders`, `order_items`, all `gram_*` data and legacy media.
3. Apply versioned schema migrations using `npm run db:migrate`; use `-- --bootstrap` only on an empty development DB. Existing production tables are not recreated. Checksums prevent editing applied migrations; future changes require a new numbered migration.
4. `npm run db:migrate-data` is a dry run by default. Review counts, then use `-- --apply` in staging. Repeat once to demonstrate idempotence. Products and photo-products remain review drafts; no blanket publication or fabricated stock. Legacy shop-cart lines are mapped separately and preserved.
5. `npm run db:setup -- --storage` provisions `fashion-private` and `fashion-catalog` buckets. `npm run db:migrate-media` reports pending legacy media; `-- --apply` uploads existing files and replaces their references, while retaining original files for recovery.
6. `npm run db:setup -- --roles` provisions separate runtime and migration logins from `SHOP_DB_APP_PASSWORD` and `SHOP_DB_MIGRATION_PASSWORD`, transfers ownership of application tables, and grants runtime DML. It does not print credentials. Run it with the administrative connection after migrations; rerun after migrations adding tables. PostgreSQL 16+ role creators require explicit INHERIT/SET membership in the migration role before transferring ownership; the provisioning script grants this to the administrative caller. Supabase API roles receive no access to internal shop/auth data.
7. Complete a pilot: private import and gallery → requested variant → mixed cart → reviewed offer → acceptance → crypto invoice → manual payment reconciliation → two supplier exports → recorded handoff → separate shipments → delivery. Do not send supplier messages or real money as part of an automated pilot.
8. Verify the explicit customer DTOs, grant revocations, foreign-owner media denial, existing profile links, historical records, tax/country configuration and real storage upload/download.

## Production cutover

1. Briefly pause order/import writes. Take a fresh database/media backup. Retain the prior application image.
2. Apply the already rehearsed migrations, data mapping and media migration. Compare source/mapped counts, owners, quantities and original financial records. Historical submitted items stay historical; they are not silently merged into paid orders.
3. Apply role provisioning. Start `docker compose --env-file .env --env-file .env.commerce -f docker-compose.yml -f docker-compose.commerce.yml up -d --no-build` with the configured server environment. App and worker must use the same restricted database and storage configuration.
4. Verify login, catalog, private imports, reviewed checkout and worker status before reopening writes. The old Next.js scheduler is disabled; persistent workers own source scheduling and retries.
5. Publish curated catalog drafts individually after checking product identity, variants, source, images and costs. An album's unrelated products are manually split using product creation; gallery images are not automatically sold as independent products. The admin gallery-merge action combines only explicitly confirmed views from the same source album.

## Monitoring and recovery

- Health: `/api/health` for the base service; verify app/worker containers and storage access separately. Query queued/running/failed `shop_jobs`, expired leases, payment exceptions and unresolved supplier orders. Jobs retry with backoff and fail visibly after five attempts; exhausted abandoned leases are finalized on the next worker claim.
- Order events and the persisted notification jobs provide an in-app history. No automatic email or supplier transport is configured in this release.
- Reverting only `SHOP_V2_ENABLED` is **not** a safe downgrade: media and private-product schema changes remain, and the old UI has been replaced. To recover before accepting new commerce orders, restore the retained image plus the matching backup in the maintenance window.
- After new real orders exist, preserve their tables/events and use a forward repair or a compatibility release. Do not restore an old database over newly accepted orders/payments.
- Keep legacy `items` and profile tables indefinitely until a separate, verified retirement migration exists. `shop_legacy_mappings` retains original URLs, states, notes and historical order snapshots.

## Local verification

Use dedicated local DB names beginning with `fashion_shop_test`; the tests refuse a remote database or a different name. Commerce and authentication suites use different DBs:

```sh
TEST_DATABASE_URL=postgres://USER@127.0.0.1:55439/fashion_shop_test \
AUTH_TEST_DATABASE_URL=postgres://USER@127.0.0.1:55439/fashion_shop_test_auth npm test
npm run typecheck
SHOP_V2_ENABLED=1 SCHEMA_MANAGED=1 npm run build
```

Without those test URLs, pure tests run and database tests explicitly skip. No local `.env.local` connection is used as an implicit integration-test target. `scripts/seed-commerce-demo.ts` accepts only a local test DB and creates browser fixtures; never run it on the VPS production database.
