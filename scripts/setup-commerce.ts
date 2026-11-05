import postgres from "postgres";
import { storageRequest } from "../src/lib/commerce/storage";
/** Provision application/migration roles without printing credentials. Existing app tables only. */
async function roles() {
  const url = process.env.MIGRATION_DATABASE_URL,
    pw = process.env.SHOP_DB_APP_PASSWORD,
    migrationPw = process.env.SHOP_DB_MIGRATION_PASSWORD;
  if (!url || !pw || !migrationPw)
    throw new Error(
      "MIGRATION_DATABASE_URL, SHOP_DB_APP_PASSWORD and SHOP_DB_MIGRATION_PASSWORD required.",
    );
  const sql = postgres(url, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      for (const [name, password] of [
        ["fashion_shop_app", pw],
        ["fashion_shop_migrator", migrationPw],
      ]) {
        const [exists] = await tx`SELECT 1 FROM pg_roles WHERE rolname=${name}`;
        const [ddl] =
          await tx`SELECT format(${exists ? "ALTER ROLE %I LOGIN PASSWORD %L" : "CREATE ROLE %I LOGIN PASSWORD %L"}::text,${name}::text,${password}::text) AS ddl`;
        await tx.unsafe(ddl.ddl);
      }
      // PostgreSQL 16+ role creators receive ADMIN but may not inherit or SET
      // the created role. Ownership transfer requires explicit membership.
      const [membership] =
        await tx`SELECT format('GRANT fashion_shop_migrator TO %I WITH INHERIT TRUE, SET TRUE',current_user) AS ddl`;
      await tx.unsafe(membership.ddl);
      await tx`REVOKE CREATE ON SCHEMA public FROM PUBLIC`;
      await tx`GRANT USAGE ON SCHEMA public TO fashion_shop_app`;
      await tx`GRANT USAGE,CREATE ON SCHEMA public TO fashion_shop_migrator`;
      const tables =
        await tx`SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'shop_%' OR tablename LIKE 'gram_%' OR tablename IN ('users','sessions','items','products','cart_items','orders','order_items','settings','login_codes','order_shares','scrape_sources'))`;
      for (const table of tables) {
        const [ddl] =
          await tx`SELECT format('ALTER TABLE public.%I OWNER TO fashion_shop_migrator',${table.tablename}::text) AS ddl`;
        await tx.unsafe(ddl.ddl);
        if (table.tablename !== "shop_migrations") {
          const [grant] =
            await tx`SELECT format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO fashion_shop_app',${table.tablename}::text) AS ddl`;
          await tx.unsafe(grant.ddl);
        }
      }
      await tx`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO fashion_shop_app`;
      await tx`REVOKE CREATE ON SCHEMA public FROM fashion_shop_app`;
    });
  } finally {
    await sql.end();
  }
}
async function buckets() {
  for (const [id, pub] of [
    [process.env.STORAGE_PRIVATE_BUCKET || "fashion-private", false],
    [process.env.STORAGE_CATALOG_BUCKET || "fashion-catalog", true],
  ] as const) {
    try {
      await storageRequest(`/bucket/${id}`);
    } catch {
      await storageRequest("/bucket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: id,
          public: pub,
          file_size_limit: 8000000,
          allowed_mime_types: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/avif",
          ],
        }),
      });
    }
  }
}
(async () => {
  if (process.argv.includes("--roles")) await roles();
  if (process.argv.includes("--storage")) await buckets();
  console.log("Requested commerce provisioning completed.");
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
