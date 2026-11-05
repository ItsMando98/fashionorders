import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import postgres from "postgres";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const url = process.env.TEST_DATABASE_URL;
const valid = url && new URL(url);
if (
  valid &&
  (!["127.0.0.1", "localhost"].includes(valid.hostname) ||
    !valid.pathname.startsWith("/fashion_shop_test"))
)
  throw new Error(
    "Commerce tests require a dedicated local fashion_shop_test database.",
  );
process.env.DATABASE_URL =
  url || "postgres://invalid:invalid@127.0.0.1:1/fashion_shop_test_disabled";
process.env.SCHEMA_MANAGED = "1";
process.env.SHOP_V2_ENABLED = "1";
const fixture =
  '<html><title>Product</title><div class="showalbumheader__gallerytitle">Black Hoodie ¥200</div><div class="showalbumheader__gallerysubtitle">Cotton hoodie</div><img data-origin-src="https://photo.yupoo.com/seller/a/front.jpg"><img data-origin-src="https://photo.yupoo.com/seller/a/back.jpg"><img data-origin-src="https://photo.yupoo.com/seller/a/front.jpg"></html>';
test("exact money and album grouping", async () => {
  const m = await import("../src/lib/commerce/money");
  assert.equal(m.saleCents(20000, "0.13", 300, "10"), 3160);
  assert.equal(m.customerFen(3160, "0.13"), 24308);
  assert.equal(m.atomAmount(10000, "60000", 8), "166667");
  assert.equal(m.formatAtoms("166667", 8), "0.00166667");
  assert.throws(() => m.integer(1.5));
  assert.throws(() => m.decimal("-1", 2));
  const { parseAlbum, canonicalUrl } = await import(
    "../src/lib/commerce/imports"
  );
  const album = parseAlbum(fixture, "https://seller.x.yupoo.com/albums/123");
  assert.equal(album.images.length, 2);
  assert.equal(album.price_cny, 200);
  assert.deepEqual(album.variant_hints.sizes, []);
  assert.throws(() => canonicalUrl("https://yupoo.com.evil.com/albums/123"));
  assert.throws(() => canonicalUrl("http://seller.x.yupoo.com/albums/123"));
  assert.equal(
    canonicalUrl("https://seller.x.yupoo.com/albums/123?uid=1#img"),
    "https://seller.x.yupoo.com/albums/123",
  );
  const { paymentUri } = await import("../src/lib/commerce/payment-uri");
  assert.equal(m.atomAmount(10000, "0.92", 6), "108695653");
  assert.equal(
    paymentUri({
      currency: "USDT",
      network: "ethereum",
      address: "0x123",
      token_contract: "0xABC",
      amount_atoms: "1000000",
      decimals: 6,
    }),
    "",
  );
  assert.match(
    paymentUri({
      currency: "USDC",
      network: "ethereum",
      address: "0x123",
      token_contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      amount_atoms: "1000000",
      decimals: 6,
    }),
    /0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1\/transfer\?address=0x123&uint256=1000000/,
  );
});
test("collection classification, procurement identity and ambiguous candidates", async () => {
  const { canonicalImportUrl, canonicalUrl, parseAlbum } = await import(
    "../src/lib/commerce/imports"
  );
  const { procurementUrl, uniqueProductImages } = await import(
    "../src/lib/server/sourcing"
  );
  assert.equal(
    canonicalImportUrl(
      "https://aa800000000000.x.yupoo.com/collections/4580705?page=2",
    ),
    "https://aa800000000000.x.yupoo.com/collections/4580705",
  );
  assert.throws(() =>
    canonicalUrl("https://aa800000000000.x.yupoo.com/collections/4580705"),
  );
  assert.throws(() =>
    canonicalImportUrl("https://yupoo.com.evil.com/collections/123"),
  );
  assert.equal(
    procurementUrl(
      "https://item.taobao.com/item.htm?id=1058102530419&spm=tracking",
    ),
    "https://item.taobao.com/item.htm?id=1058102530419",
  );
  assert.equal(
    procurementUrl("https://item.taobao.com.evil.com/item.htm?id=123"),
    null,
  );
  assert.equal(
    procurementUrl("https://item.taobao.com@127.0.0.1/item.htm?id=123"),
    null,
  );
  assert.equal(
    procurementUrl("https://weidian.com/item.html?itemID=123&spider_token=x"),
    "https://weidian.com/item.html?itemID=123",
  );
  const html = fixture.replace(
    "Cotton hoodie",
    '尺码：M L XL\n颜色：黑 咖啡 紫色\n<a href="/external?url=https%3A%2F%2Fitem.taobao.com%2Fitem.htm%3Fid%3D1058102530419">Order</a> https://weidian.com/item.html?itemID=123',
  );
  const product = parseAlbum(html, "https://seller.x.yupoo.com/albums/123");
  assert.equal(product.procurement_links?.length, 2);
  assert.deepEqual(product.variant_hints.sizes, ["M", "L", "XL"]);
  assert.deepEqual(product.variant_hints.colors, ["黑", "咖啡", "紫色"]);
  assert.doesNotMatch(product.description, /https?:/);
  const { collectAlbumUrls } = await import("../src/lib/server/seller-scraper");
  assert.deepEqual(
    uniqueProductImages([
      "https://photo.yupoo.com/seller/0841ec36ad/medium.png",
      "https://photo.yupoo.com/seller/0841ec36ad/446394ad.png",
    ]),
    ["https://photo.yupoo.com/seller/0841ec36ad/446394ad.png"],
  );
  const visited: string[] = [];
  const urls = await collectAlbumUrls(
    "https://seller.x.yupoo.com/collections/123",
    5,
    3,
    async (url) => {
      visited.push(url);
      return url.includes("page=1")
        ? [
            { id: "1", title: "Shirt" },
            { id: "2", title: "Coat" },
          ]
        : [{ id: "1", title: "Shirt" }];
    },
  );
  assert.equal(urls.length, 2);
  assert.ok(visited.every((url) => url.includes("/collections/123?page=")));
});
test("web image optimization rotates, strips metadata and generates smaller responsive images", async () => {
  const sharp = (await import("sharp")).default;
  const { optimizeImage, spreadsheetImage } = await import(
    "../src/lib/commerce/image-optimization"
  );
  const source = await sharp({
    create: { width: 3000, height: 1800, channels: 3, background: "#345677" },
  })
    .jpeg({ quality: 95 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const web = await optimizeImage(source);
  const meta = await sharp(web).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.height, 1600);
  assert.equal(meta.width, 960);
  assert.equal(meta.orientation, undefined);
  assert.equal(meta.exif, undefined);
  assert.ok(web.length < source.length);
  const thumb = await sharp(await optimizeImage(web, 240)).metadata();
  assert.equal(thumb.height, 240);
  const small = await sharp(
    await optimizeImage(
      await sharp({
        create: { width: 32, height: 24, channels: 3, background: "white" },
      })
        .png()
        .toBuffer(),
    ),
  ).metadata();
  assert.equal(small.width, 32);
  assert.equal(
    (await sharp(await spreadsheetImage(web)).metadata()).format,
    "png",
  );
  const { uniqueProductImages } = await import("../src/lib/server/sourcing");
  assert.equal(
    uniqueProductImages(
      Array.from(
        { length: 120 },
        (_, i) => `https://photo.yupoo.com/seller/photo-${i}.jpg`,
      ),
    ).length,
    120,
  );
});
test("external image analysis is blocked before image loading without provider consent", async () => {
  const keys = [
    "GEMINI_API_KEY",
    "CATALOG_AGENT_PROVIDER",
    "CATALOG_AGENT_IMAGE_CONSENT",
  ];
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.GEMINI_API_KEY = "test-placeholder";
    process.env.CATALOG_AGENT_PROVIDER = "gemini";
    delete process.env.CATALOG_AGENT_IMAGE_CONSENT;
    const G = await import("../src/lib/commerce/catalog-agent");
    assert.equal(G.agentConfigured(), false);
    let read = false;
    await assert.rejects(() =>
      G.analyzeImages([{ id: 1 }], async () => {
        read = true;
        return Buffer.alloc(0);
      }),
    );
    assert.equal(read, false);
    process.env.CATALOG_AGENT_IMAGE_CONSENT = "openai";
    assert.equal(G.agentConfigured(), false);
  } finally {
    for (const key of keys)
      before[key] === undefined
        ? delete process.env[key]
        : (process.env[key] = before[key]);
  }
});
test("visual agent rejects foreign IDs, duplicate groups and non-product heroes", async () => {
  const { validateAudit } = await import("../src/lib/commerce/catalog-agent");
  const valid = {
    decisions: [
      {
        product_id: 1,
        kind: "product",
        confidence: 0.99,
        reason: "Ein Loafer",
      },
      {
        product_id: 2,
        kind: "detail",
        confidence: 0.99,
        reason: "Passende Sohle",
      },
    ],
    groups: [
      {
        representative_id: 1,
        representative_media_id: null,
        member_ids: [1, 2],
        title: "Schwarzer Loafer",
        category_id: "loafers",
        confidence: 0.99,
        reason: "Gleiche Konstruktion",
      },
    ],
  };
  assert.equal(validateAudit(valid, [1, 2]).groups.length, 1);
  assert.throws(() =>
    validateAudit(
      valid,
      [1, 2],
      [
        { id: 1, media: [{ id: 10 }] },
        { id: 2, media: [{ id: 20 }] },
      ],
    ),
  );
  assert.throws(() => validateAudit(valid, [1, 3]));
  assert.throws(() =>
    validateAudit(
      { ...valid, groups: [...valid.groups, ...valid.groups] },
      [1, 2],
    ),
  );
  assert.throws(() =>
    validateAudit(
      {
        ...valid,
        decisions: [
          { ...valid.decisions[0], kind: "packaging" },
          valid.decisions[1],
        ],
      },
      [1, 2],
    ),
  );
});
test("persistent media cache reuses resized images after the original is unavailable", async () => {
  const os = await import("node:os"),
    path = await import("node:path");
  const sharp = (await import("sharp")).default;
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "fashion-media-cache-"),
  );
  const previous = {
    cache: process.env.FASHION_ORDERS_CACHE,
    web: process.env.MEDIA_WEB_CACHE,
  };
  process.env.FASHION_ORDERS_CACHE = directory;
  process.env.MEDIA_WEB_CACHE = path.join(directory, "web");
  try {
    const source = path.join(directory, "source.png");
    await sharp({
      create: { width: 1200, height: 900, channels: 3, background: "#223344" },
    })
      .png()
      .toFile(source);
    const { cachedMedia, mediaEtag } = await import(
      "../src/lib/commerce/media-cache"
    );
    const m = { bucket: "legacy", object_path: "source.png" };
    await cachedMedia(m, 1600);
    const [first, second] = await Promise.all([
      cachedMedia(m, 640),
      cachedMedia(m, 640),
    ]);
    assert.deepEqual(first, second);
    fs.unlinkSync(source);
    assert.deepEqual(await cachedMedia(m, 640), first);
    const thumb = await cachedMedia(m, 240);
    assert.equal((await sharp(thumb).metadata()).width, 240);
    assert.equal(mediaEtag(first), mediaEtag(second));
    assert.ok(
      fs
        .readdirSync(path.join(directory, "web"))
        .every((n) => n.endsWith(".webp")),
    );
  } finally {
    previous.cache === undefined
      ? delete process.env.FASHION_ORDERS_CACHE
      : (process.env.FASHION_ORDERS_CACHE = previous.cache);
    previous.web === undefined
      ? delete process.env.MEDIA_WEB_CACHE
      : (process.env.MEDIA_WEB_CACHE = previous.web);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test(
  "isolated PostgreSQL commerce lifecycle and security",
  { skip: !url },
  async (t) => {
    const sql = postgres(url!, { max: 10, onnotice: () => {} });
    const { migrateCommerce } = await import("../scripts/migrate-commerce");
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await sql.unsafe(
      "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$;",
    );
    await migrateCommerce(url!, true);
    await migrateCommerce(url!);
    const { getSql } = await import("../src/lib/server/db");
    const C = await import("../src/lib/commerce/catalog"),
      O = await import("../src/lib/commerce/orders"),
      P = await import("../src/lib/commerce/payments"),
      F = await import("../src/lib/commerce/procurement"),
      I = await import("../src/lib/commerce/imports");
    const [a, b, ad] =
      await sql`INSERT INTO users(name,password_hash,role) VALUES('Test A','test','friend'),('Test B','test','friend'),('Test Admin','test','admin') RETURNING id,name,role`;
    const user = (r: Record<string, any>) =>
      ({
        id: r.id,
        name: r.name,
        role: r.role,
        avatar_initials: "TT",
        share_all_friends: 0,
      }) as import("../src/lib/types").User;
    const A = user(a),
      B = user(b),
      admin = user(ad);
    await sql`INSERT INTO settings(key,value) VALUES('cny_to_eur','0.13'),('shop_operator','Test Operator'),('shop_tax_note','Test tax configuration'),('shop_countries','DE') ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
    let importedId = 0,
      orderId = 0,
      variantId = 0;
    await t.test("migration versions and API grants", async () => {
      const rows = await sql`SELECT version FROM shop_migrations`;
      assert.equal(rows.length, 8);
      const [rights] =
        await sql`SELECT has_table_privilege('anon','public.users','SELECT') AS users,has_table_privilege('authenticated','public.shop_orders','SELECT') AS orders`;
      assert.equal(rights.users, false);
      assert.equal(rights.orders, false);
    });
    await t.test(
      "persisted job, grouped images and private owner isolation",
      async () => {
        const ids = await I.queueImports(A, [
          "https://seller.x.yupoo.com/albums/123",
        ]);
        const job = await I.claimJob();
        assert.equal(job?.id, ids[0]);
        assert.ok(job);
        const scraper = async () =>
          I.parseAlbum(fixture, "https://seller.x.yupoo.com/albums/123");
        const uploader = async (
          _u: string,
          _r: string,
          _b: string,
          key: string,
        ) => key + "/image" + (_u.includes("back") ? "2" : "1") + ".jpg";
        const result = await I.runImport(job!, job!.token, scraper, uploader);
        importedId = result.product_id;
        const p = await C.productDTO(
          getSql(),
          A,
          await C.accessible(getSql(), A, importedId),
        );
        assert.equal(p.media.length, 2);
        assert.equal(p.visibility, "private");
        assert.equal(p.variants.length, 1);
        assert.equal(p.variants[0].price_approved, false);
        assert.equal("purchase_fen" in p.variants[0], false);
        await assert.rejects(() => C.accessible(getSql(), B, importedId));
        await I.queueImports(B, ["https://seller.x.yupoo.com/albums/123"]);
        const j2 = await I.claimJob();
        const r2 = await I.runImport(j2!, j2!.token, scraper, uploader);
        assert.notEqual(r2.product_id, importedId);
      },
    );
    await t.test(
      "unlimited collections persist page continuations and stop repeated pages",
      async () => {
        await I.queueImports(A, ["https://seller.x.yupoo.com/collections/123"]);
        const first = await I.claimJob();
        const page1 = Array.from(
          { length: 300 },
          (_, i) => `https://seller.x.yupoo.com/albums/${1000 + i}`,
        );
        const one = await I.expandCollection(
          first!,
          first!.token,
          async () => page1,
        );
        assert.equal(one.albums, 300);
        assert.equal(one.complete, false);
        const next = await I.claimJob();
        assert.equal(next?.id, one.continuation);
        await sql`UPDATE shop_jobs SET lease_until=now()-interval '1 second' WHERE id=${next!.id}`;
        const reclaimed = await I.claimJob();
        assert.equal(reclaimed?.id, next?.id);
        await assert.rejects(() =>
          I.expandCollection(next!, next!.token, async () => page1),
        );
        const two = await I.expandCollection(
          reclaimed!,
          reclaimed!.token,
          async () =>
            Array.from(
              { length: 150 },
              (_, i) => `https://seller.x.yupoo.com/albums/${1300 + i}`,
            ),
        );
        assert.equal(two.albums, 450);
        const last = await I.claimJob();
        const done = await I.expandCollection(
          last!,
          last!.token,
          async () => page1,
        );
        assert.equal(done.albums, 450);
        assert.equal(done.complete, true);
        const children =
          await sql`SELECT * FROM shop_jobs WHERE payload->>'collection_url'=${first!.payload.url}`;
        assert.equal(children.length, 450);
        assert.ok(
          children.every((c) => c.user_id === A.id && !c.payload.catalog),
        );
        await sql`UPDATE shop_jobs SET status='done' WHERE payload->>'collection_url'=${first!.payload.url}`;
        const [root] =
          await sql`SELECT result FROM shop_jobs WHERE id=${first!.id}`;
        assert.equal(root.result.complete, true);
      },
    );
    await t.test(
      "procurement metadata stays admin-only and manual choice survives rescrape",
      async () => {
        const [job] =
          await sql`INSERT INTO shop_jobs(user_id,kind,status,token,lease_until,payload) VALUES(${A.id},'import','running','00000000-0000-4000-8000-000000000001',now()+interval '3 minutes',${sql.json({ url: "https://seller.x.yupoo.com/albums/123" })}) RETURNING *`;
        const scrape = async () => ({
          ...I.parseAlbum(fixture, job.payload.url),
          procurement_links: [
            "https://item.taobao.com/item.htm?id=1058102530419",
          ],
        });
        await I.runImport(
          job,
          "00000000-0000-4000-8000-000000000001",
          scrape,
          async () => "test/image.jpg",
        );
        const customer = await C.productDTO(
          getSql(),
          A,
          await C.accessible(getSql(), A, importedId),
        );
        assert.equal("procurement_url" in customer, false);
        assert.equal("procurement_links" in customer, false);
        await C.saveProduct(admin, importedId, {
          procurement_url: "https://weidian.com/item.html?itemID=789",
        });
        await sql`UPDATE shop_jobs SET status='running',lease_until=now()+interval '3 minutes' WHERE id=${job.id}`;
        await I.runImport(
          job,
          "00000000-0000-4000-8000-000000000001",
          scrape,
          async () => "test/image.jpg",
        );
        const [product] =
          await sql`SELECT procurement_url FROM products WHERE id=${importedId}`;
        assert.equal(
          product.procurement_url,
          "https://weidian.com/item.html?itemID=789",
        );
        await sql`UPDATE shop_jobs SET status='running',lease_until=now()+interval '3 minutes' WHERE id=${job.id}`;
        const partial = await I.runImport(
          job,
          "00000000-0000-4000-8000-000000000001",
          scrape,
          async (url) => {
            if (url.includes("back")) throw new Error("image unavailable");
            return "test/front.jpg";
          },
        );
        assert.equal(partial.source_images, 2);
        assert.equal(partial.images, 1);
        assert.ok(partial.warnings.some((w) => w.includes("1 von 2 Bildern")));
      },
    );
    await t.test("worker reclaim fences stale completion", async () => {
      await I.queueImports(A, ["https://seller.x.yupoo.com/albums/124"]);
      const j = await I.claimJob();
      await sql`UPDATE shop_jobs SET lease_until=now()-interval '1 second' WHERE id=${j!.id}`;
      const reclaimed = await I.claimJob();
      assert.equal(reclaimed?.id, j!.id);
      assert.notEqual(reclaimed?.token, j!.token);
      await assert.rejects(() =>
        I.runImport(
          j!,
          j!.token,
          async () =>
            I.parseAlbum(fixture, "https://seller.x.yupoo.com/albums/124"),
          async () => "test.jpg",
        ),
      );
      await sql`UPDATE shop_jobs SET status='done' WHERE id=${j!.id}`;
    });
    await t.test(
      "variants separate colors and preserve combination filters",
      async () => {
        const [p] =
          await sql`INSERT INTO products(title,brand,visibility,publication) VALUES('Catalog Hoodie','Test','catalog','published') RETURNING id`;
        const vs =
          await sql`INSERT INTO shop_variants(product_id,size,color,purchase_fen,price_approved,availability) VALUES(${p.id},'M','Black',20000,true,'available'),(${p.id},'M','White',21000,true,'available'),(${p.id},'L','Red',22000,true,'available') RETURNING id`;
        variantId = vs[0].id;
        await O.changeCart(A, { variant_id: vs[0].id, quantity: 1 });
        await O.changeCart(A, { variant_id: vs[1].id, quantity: 2 });
        const cart = await O.cart(A);
        assert.equal(cart.lines.length, 2);
        const filtered = await C.catalog(
          A,
          new URLSearchParams({ size: "M", color: "Red" }),
        );
        assert.equal(filtered.products.length, 0);
        await assert.rejects(() =>
          O.changeCart(B, { quantity: 2 }, cart.lines[0].id),
        );
        const [pv] =
          await sql`SELECT id FROM shop_variants WHERE product_id=${importedId}`;
        await O.changeCart(A, { variant_id: pv.id, quantity: 1 });
      },
    );
    await t.test(
      "catalog returns created_at and exclude hides that product from recommendations",
      async () => {
        const rows =
          await sql`INSERT INTO products(title,brand,visibility,publication,gender) VALUES('Exclude Keep','Keep','catalog','published','men'),('Exclude Hide','Hide','catalog','published','men') RETURNING id,created_at`;
        for (const p of rows)
          await sql`INSERT INTO shop_variants(product_id,size,color,purchase_fen,price_approved,availability) VALUES(${p.id},'M','Navy',15000,true,'available')`;
        await sql`INSERT INTO shop_product_categories(product_id,category_id) VALUES(${rows[0].id},'sneakers'),(${rows[1].id},'sneakers') ON CONFLICT DO NOTHING`;
        const listed = await C.catalog(
          A,
          new URLSearchParams({ category: "sneakers" }),
        );
        const keep = listed.products.find((p: { id: number }) => p.id === rows[0].id);
        const hide = listed.products.find((p: { id: number }) => p.id === rows[1].id);
        assert.ok(keep);
        assert.ok(hide);
        assert.ok(keep.created_at);
        assert.match(String(keep.created_at), /^\d{4}-/);
        const without = await C.catalog(
          A,
          new URLSearchParams({
            category: "sneakers",
            exclude: String(rows[0].id),
          }),
        );
        assert.equal(
          without.products.some((p: { id: number }) => p.id === rows[0].id),
          false,
        );
        assert.ok(without.products.some((p: { id: number }) => p.id === rows[1].id));
        const { createSession } = await import("../src/lib/server/auth");
        const { commerceRoute } = await import("../src/lib/commerce/api");
        const token = await createSession(A.id);
        const session = await commerceRoute(
          new Request("http://localhost/api/commerce/session", {
            headers: { cookie: `fo_session=${token}` },
          }),
          ["session"],
        );
        assert.equal(session.status, 200);
        const body = await session.json();
        assert.equal(typeof body.saved_count, "number");
      },
    );
    await t.test(
      "parallel checkout is idempotent and owner scoped",
      async () => {
        const cart = await O.cart(A);
        const body = {
          version: cart.version,
          address: {
            name: "Test A",
            street: "Example 1",
            zip: "12345",
            city: "Berlin",
            country: "DE",
          },
        };
        const key = "same-checkout-key-1234";
        const ids = await Promise.all([
          O.submitCart(A, body, key),
          O.submitCart(A, body, key),
        ]);
        assert.equal(ids[0], ids[1]);
        orderId = ids[0];
        assert.equal((await O.cart(A)).lines.length, 0);
        const detail = await O.orderDetail(A, orderId);
        assert.equal(detail.items.length, 3);
        assert.equal(detail.status, "review");
        assert.equal(detail.payments.length, 0);
        assert.equal("supplier" in detail.items[0], false);
        assert.equal("purchase_fen" in detail.items[0], false);
        await assert.rejects(() => O.orderDetail(B, orderId));
        await assert.rejects(() =>
          O.submitCart(A, { ...body, version: 100 }, key),
        );
      },
    );
    await t.test(
      "offers require all lines, latest version and fresh expiry",
      async () => {
        const items =
          await sql`SELECT * FROM shop_order_items WHERE order_id=${orderId}`;
        const body = {
          shipping_cents: 500,
          delivery_note: "Test delivery",
          lines: items.map((i, n) => ({
            item_id: i.id,
            size: "M",
            color: i.color,
            unit_cents: 3000,
            purchase_fen: 20000,
            supplier: n === 0 ? "Supplier A" : "Supplier B",
          })),
        };
        await assert.rejects(() => O.createOffer(B, orderId, body));
        await O.createOffer(admin, orderId, body);
        const first = (await O.orderDetail(A, orderId)).offers[0];
        await O.createOffer(admin, orderId, body);
        await assert.rejects(() => O.acceptOffer(A, orderId, first.id));
        const latest = (await O.orderDetail(A, orderId)).offers[0];
        await sql`UPDATE shop_offers SET expires_at=now()-interval '1 second' WHERE id=${latest.id}`;
        await assert.rejects(() => O.acceptOffer(A, orderId, latest.id));
        await sql`UPDATE shop_offers SET expires_at=now()+interval '1 hour' WHERE id=${latest.id}`;
        await O.acceptOffer(A, orderId, latest.id);
        await O.acceptOffer(A, orderId, latest.id);
        await assert.rejects(() => O.createOffer(admin, orderId, body));
      },
    );
    await t.test(
      "quote outage, parallel payments and exact amount",
      async () => {
        const [method] =
          await sql`INSERT INTO shop_payment_methods(currency,network,address,decimals,enabled) VALUES('BTC','bitcoin','bc1-test-wallet',8,true) RETURNING id`;
        await assert.rejects(() =>
          P.createPayment(A, orderId, method.id, async () => {
            throw new Error("outage");
          }),
        );
        const ids = await Promise.all([
          P.createPayment(A, orderId, method.id, async () => "60000"),
          P.createPayment(A, orderId, method.id, async () => "60000"),
        ]);
        assert.equal(ids[0], ids[1]);
        const p = (await O.orderDetail(A, orderId)).payments[0];
        assert.equal(p.amount_atoms, "208334");
        await P.submitTxid(A, orderId, p.id, "a".repeat(64));
        assert.equal(
          (await O.orderDetail(A, orderId)).payment_status,
          "review",
        );
        await assert.rejects(() => F.createPurchases(admin, orderId));
        await P.confirmPayment(admin, orderId, p.id, {
          verified_network: "bitcoin",
          verified_address: p.address,
          actual_atoms: "208334",
        });
        assert.equal(
          (await O.orderDetail(A, orderId)).payment_status,
          "confirmed",
        );
      },
    );
    await t.test(
      "supplier export allocation and partial shipments",
      async () => {
        await sql`UPDATE products SET procurement_url='https://item.taobao.com/item.htm?id=1058102530419' WHERE id IN (SELECT product_id FROM shop_order_items WHERE order_id=${orderId})`;
        await F.createPurchases(admin, orderId);
        await F.createPurchases(admin, orderId);
        let pos = await F.purchases(admin, orderId);
        assert.equal(pos.length, 2);
        assert.ok(
          pos.every((po) =>
            po.items.every(
              (i: Record<string, any>) =>
                i.procurement_url ===
                "https://item.taobao.com/item.htm?id=1058102530419",
            ),
          ),
        );
        await sql`UPDATE products SET procurement_url='' WHERE id IN (SELECT product_id FROM shop_order_items WHERE order_id=${orderId})`;
        assert.ok(
          (await F.purchases(admin, orderId)).every((po) =>
            po.items.every(
              (i: Record<string, any>) =>
                i.procurement_url ===
                "https://item.taobao.com/item.htm?id=1058102530419",
            ),
          ),
        );

        for (const po of pos) {
          await F.updatePurchase(admin, orderId, po.id, {
            status: "sent",
            recipient: "Supplier test channel",
          });
          await F.updatePurchase(admin, orderId, po.id, {
            status: "confirmed",
            external_reference: "TEST-" + po.id,
          });
          await F.shipment(admin, orderId, po.id, {
            carrier: "Test Carrier",
            tracking: "TRACK-" + po.id,
            items: po.items.map((i: Record<string, any>) => ({
              purchase_item_id: i.id,
              quantity: i.quantity,
            })),
          });
          await assert.rejects(() =>
            F.shipment(admin, orderId, po.id, {
              carrier: "Test",
              tracking: "DUP",
              items: po.items.map((i: Record<string, any>) => ({
                purchase_item_id: i.id,
                quantity: i.quantity,
              })),
            }),
          );
        }
        const detail = await O.orderDetail(A, orderId);
        assert.equal(detail.shipments.length, 2);
        for (const s of detail.shipments) await F.deliver(admin, orderId, s.id);
        assert.equal((await O.orderDetail(A, orderId)).status, "completed");
      },
    );
    await t.test(
      "customer API rejects private media before storage and strips financial internals",
      async () => {
        const { createSession } = await import("../src/lib/server/auth");
        const { commerceRoute } = await import("../src/lib/commerce/api");
        const token = await createSession(B.id);
        const [m] =
          await sql`SELECT id FROM shop_media WHERE product_id=${importedId} LIMIT 1`;
        const denied = await commerceRoute(
          new Request(`http://localhost/api/commerce/media/${m.id}`, {
            headers: { cookie: `fo_session=${token}` },
          }),
          ["media", String(m.id)],
        );
        assert.equal(denied.status, 404);
        const unauth = await commerceRoute(
          new Request("http://localhost/api/commerce/orders"),
          ["orders"],
        );
        assert.equal(unauth.status, 401);
      },
    );
    await t.test("explicit collection sharing and revocation", async () => {
      const [c] =
        await sql`INSERT INTO shop_collections(user_id,name) VALUES(${A.id},'Private selection') RETURNING id`;
      await sql`INSERT INTO shop_collection_items(collection_id,product_id) VALUES(${c.id},${importedId})`;
      await sql`INSERT INTO shop_collection_shares(collection_id,user_id) VALUES(${c.id},${B.id})`;
      const shared = await C.productDTO(
        getSql(),
        B,
        await C.accessible(getSql(), B, importedId),
      );
      assert.equal("import_url" in shared, false);
      assert.equal(shared.notes, "");
      await sql`DELETE FROM shop_collection_shares WHERE collection_id=${c.id}`;
      await assert.rejects(() => C.accessible(getSql(), B, importedId));
    });
    await t.test(
      "late and underpaid transactions require explicit reconciliation",
      async () => {
        await O.changeCart(A, { variant_id: variantId, quantity: 1 });
        const c = await O.cart(A);
        const id = await O.submitCart(
          A,
          {
            version: c.version,
            address: {
              name: "Test",
              street: "Example 1",
              zip: "12345",
              city: "Berlin",
              country: "DE",
            },
          },
          "late-payment-order-1234",
        );
        const detail = await O.orderDetail(admin, id);
        await O.createOffer(admin, id, {
          shipping_cents: 0,
          delivery_note: "Test",
          lines: detail.items.map((i) => ({
            item_id: i.id,
            unit_cents: 1000,
            purchase_fen: 1000,
            supplier: "Supplier A",
          })),
        });
        const offer = (await O.orderDetail(A, id)).offers[0];
        await O.acceptOffer(A, id, offer.id);
        const [method] = await sql`SELECT id FROM shop_payment_methods LIMIT 1`;
        const payment = await P.createPayment(
          A,
          id,
          method.id,
          async () => "60000",
        );
        await sql`UPDATE shop_payment_requests SET expires_at=now()-interval '1 second' WHERE id=${payment}`;
        await assert.rejects(() =>
          P.submitTxid(A, id, payment, "a".repeat(64)),
        );
        await P.submitTxid(A, id, payment, "b".repeat(64));
        let d = await O.orderDetail(A, id);
        assert.equal(d.payments[0].exception, "late_payment");
        await P.confirmPayment(admin, id, payment, {
          verified_network: "bitcoin",
          verified_address: d.payments[0].address,
          actual_atoms: "1",
        });
        d = await O.orderDetail(A, id);
        assert.equal(d.payments[0].exception, "underpayment");
        assert.equal(d.payment_status, "review");
      },
    );
    await t.test(
      "USDC uses native Ethereum contract and exact six-decimal invoices",
      async () => {
        const contract = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        await P.saveMethod(admin, {
          currency: "USDC",
          network: "ethereum",
          address: "0x" + "1".repeat(40),
          enabled: false,
        });
        const [method] =
          await sql`SELECT * FROM shop_payment_methods WHERE currency='USDC'`;
        assert.equal(method.token_contract, contract);
        assert.equal(method.decimals, 6);
        await assert.rejects(() =>
          P.saveMethod(admin, {
            currency: "USDT",
            network: "ethereum",
            address: "0x" + "1".repeat(40),
            enabled: false,
          }),
        );
        await assert.rejects(
          () =>
            sql`INSERT INTO shop_payment_methods(currency,network,address,decimals,enabled) VALUES('ETH','ethereum','legacy',18,true)`,
        );
        await sql`UPDATE shop_payment_methods SET enabled=true WHERE id=${method.id}`;
        await O.changeCart(A, { variant_id: variantId, quantity: 1 });
        const c = await O.cart(A);
        const order = await O.submitCart(
          A,
          {
            version: c.version,
            address: {
              name: "Test",
              street: "Example 1",
              zip: "12345",
              city: "Berlin",
              country: "DE",
            },
          },
          "usdc-checkout-key-1234",
        );
        const detail = await O.orderDetail(admin, order);
        await O.createOffer(admin, order, {
          shipping_cents: 0,
          delivery_note: "Test",
          lines: detail.items.map((i) => ({
            item_id: i.id,
            unit_cents: 10000,
            purchase_fen: 20000,
            supplier: "Supplier A",
          })),
        });
        const offer = (await O.orderDetail(A, order)).offers[0];
        await O.acceptOffer(A, order, offer.id);
        await P.createPayment(A, order, method.id, async () => "0.92");
        const payment = (await O.orderDetail(A, order)).payments[0];
        assert.equal(payment.currency, "USDC");
        assert.equal(payment.amount_atoms, "108695653");
        assert.equal(payment.token_contract, contract);
        assert.equal(payment.decimals, 6);
      },
    );
    await t.test(
      "data migration dry run and repeatable preservation",
      async () => {
        await sql`INSERT INTO items(user_id,url,title,stage,order_status,price_cny,custom_fee_fixed_eur) VALUES(${A.id},'https://seller.x.yupoo.com/albums/999','Legacy submitted','submitted','To Order',100,5)`;
        await sql`INSERT INTO cart_items(user_id,product_id,chosen_size,color_variant,quantity) SELECT ${A.id},product_id,'S','Navy',2 FROM shop_variants WHERE id=${variantId}`;
        const { migrateData } = await import(
          "../scripts/migrate-commerce-data"
        );
        const dry = await migrateData(url!);
        assert.equal(dry.mode, "dry-run");
        await migrateData(url!, true);
        await migrateData(url!, true);
        const [n] =
          await sql`SELECT count(*)::int AS n FROM shop_legacy_mappings WHERE kind='item'`;
        assert.equal(n.n, 1);
        const [old] =
          await sql`SELECT order_status FROM items WHERE title='Legacy submitted'`;
        assert.equal(old.order_status, "To Order");
        const [mapped] =
          await sql`SELECT v.fee_fixed_cents FROM shop_variants v JOIN shop_legacy_mappings m ON m.new_id=v.product_id AND m.kind='item'`;
        assert.equal(mapped.fee_fixed_cents, "500");
        const [legacyCart] =
          await sql`SELECT c.quantity,v.size,v.color FROM shop_cart c JOIN shop_variants v ON v.id=c.variant_id JOIN shop_legacy_mappings m ON m.kind='cart' AND m.new_id=c.id`;
        assert.equal(legacyCart.quantity, 2);
        assert.equal(legacyCart.size, "S");
        assert.equal(legacyCart.color, "Navy");
      },
    );
    await t.test(
      "agent groups only catalog photos, keeps history, handles old cart entries and reverts",
      async () => {
        const G = await import("../src/lib/commerce/catalog-agent");
        const photos =
          await sql`INSERT INTO products(title,brand,visibility,publication,source_url) VALUES('Agent hero','—','catalog','published','https://seller.x.yupoo.com/albums/444#hero'),('Agent detail','—','catalog','published','https://seller.x.yupoo.com/albums/444#detail'),('Agent box','—','catalog','published','https://seller.x.yupoo.com/albums/444#box'),('Agent uncertain','—','catalog','published','https://seller.x.yupoo.com/albums/444#uncertain') RETURNING *`;
        for (const p of photos) {
          await sql`INSERT INTO shop_variants(product_id,size) VALUES(${p.id},'Noch festzulegen')`;
          await sql`INSERT INTO shop_media(product_id,object_path,bucket,alt) VALUES(${p.id},${"agent-" + p.id + ".jpg"},'legacy',${p.title})`;
        }
        const [boxVariant] =
          await sql`SELECT id FROM shop_variants WHERE product_id=${photos[2].id}`;
        await sql`INSERT INTO shop_cart(user_id,variant_id,quantity) VALUES(${A.id},${boxVariant.id},1)`;
        const [audit] =
          await sql`INSERT INTO shop_catalog_audits(actor_id,source_album,input) VALUES(${admin.id},'https://seller.x.yupoo.com/albums/444',${sql.json(photos)}) RETURNING *`;
        const [job] =
          await sql`INSERT INTO shop_jobs(user_id,kind,status,token,lease_until,payload) VALUES(${admin.id},'catalog_audit','running','00000000-0000-4000-8000-000000000007',now()+interval '3 minutes',${sql.json({ audit_id: audit.id, auto_apply: true })}) RETURNING *`;
        let calls = 0;
        const analyze = async () => {
          calls++;
          return {
            model: "fixture-vision",
            output: {
              decisions: photos.map((p, i) => ({
                product_id: p.id,
                kind: ["product", "detail", "packaging", "uncertain"][i],
                confidence: i === 3 ? 0.5 : 0.99,
                reason: "Visuell geprüft",
              })),
              groups: [
                {
                  representative_id: photos[0].id,
                  representative_media_id: (
                    await sql`SELECT id FROM shop_media WHERE product_id=${photos[0].id} ORDER BY position,id LIMIT 1`
                  )[0].id,
                  member_ids: [photos[0].id, photos[1].id],
                  title: "Schwarzer Loafer",
                  category_id: "loafers",
                  confidence: 0.99,
                  reason: "Gleiche Konstruktion",
                },
              ],
            },
          } as Awaited<ReturnType<typeof G.analyzeImages>>;
        };
        await G.runCatalogAudit(job, job.token, analyze);
        await G.runCatalogAudit(job, job.token, analyze);
        assert.equal(calls, 1);
        const [state] =
          await sql`SELECT status FROM shop_catalog_audits WHERE id=${audit.id}`;
        assert.equal(state.status, "applied");
        const [hero] =
          await sql`SELECT * FROM products WHERE id=${photos[0].id}`;
        assert.equal(hero.title, "Schwarzer Loafer");
        assert.equal(hero.publication, "published");
        const gallery =
          await sql`SELECT * FROM shop_media WHERE product_id=${hero.id}`;
        assert.equal(gallery.length, 2);
        assert.equal(
          (
            await sql`SELECT * FROM shop_product_aliases WHERE source_product_id=${photos[1].id}`
          )[0].target_product_id,
          hero.id,
        );
        const oldCart = await O.cart(A);
        assert.equal(
          oldCart.lines.find((l) => l.variant.id === boxVariant.id)!.variant
            .availability,
          "unavailable",
        );
        await assert.rejects(() => G.revertAudit(A, audit.id));
        await G.revertAudit(admin, audit.id);
        assert.equal(
          (await sql`SELECT * FROM shop_media WHERE product_id=${hero.id}`)
            .length,
          1,
        );
        assert.equal(
          (
            await sql`SELECT publication FROM products WHERE id=${photos[2].id}`
          )[0].publication,
          "published",
        );
        assert.equal(
          (
            await sql`SELECT * FROM shop_product_aliases WHERE audit_id=${audit.id}`
          ).length,
          0,
        );
        await sql`DELETE FROM shop_cart WHERE variant_id=${boxVariant.id}`;
      },
    );
    await t.test(
      "only new catalog listings are queued; private imports and legacy mappings never reach the agent",
      async () => {
        const keys = [
          "CATALOG_AGENT_PROVIDER",
          "CATALOG_AGENT_IMAGE_CONSENT",
          "CATALOG_AGENT_MIN_PRODUCT_ID",
          "CATALOG_AGENT_MIN_MEDIA_ID",
          "CATALOG_AGENT_API_KEY",
        ];
        const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
        try {
          Object.assign(process.env, {
            CATALOG_AGENT_PROVIDER: "gemini",
            CATALOG_AGENT_IMAGE_CONSENT: "gemini",
            CATALOG_AGENT_MIN_PRODUCT_ID: "0",
            CATALOG_AGENT_MIN_MEDIA_ID: "0",
            CATALOG_AGENT_API_KEY: "test-not-a-real-key",
          });
          const G = await import("../src/lib/commerce/catalog-agent");
          const result = await G.queueCatalogAudit(admin);
          assert.ok(result.products > 0);
          const audits =
            await sql`SELECT input FROM shop_catalog_audits WHERE status='queued'`;
          const protectedIds = new Set(
            (
              await sql`SELECT new_id FROM shop_legacy_mappings WHERE kind='catalog'`
            ).map((r) => r.new_id),
          );
          for (const a of audits)
            for (const p of a.input) {
              assert.equal(p.visibility, "catalog");
              assert.equal(protectedIds.has(p.id), false);
              assert.ok(p.media.length > 0);
            }
          const [j] =
            await sql`INSERT INTO shop_jobs(user_id,kind,status,token,lease_until,payload) VALUES(${admin.id},'import','running','00000000-0000-4000-8000-000000000008',now()+interval '3 minutes',${sql.json({ url: "https://seller.x.yupoo.com/albums/90001", catalog: true })}) RETURNING *`;
          const imported = await I.runImport(
            j,
            j.token,
            async () => I.parseAlbum(fixture, j.payload.url),
            async () => "new/image.webp",
          );
          const [queued] =
            await sql`SELECT id FROM shop_catalog_audits WHERE input @> ${sql.json([{ id: imported.product_id }])}`;
          assert.ok(queued);
          const [newProduct] =
            await sql`SELECT publication FROM products WHERE id=${imported.product_id}`;
          assert.equal(newProduct.publication, "review");
        } finally {
          for (const k of keys)
            before[k] === undefined
              ? delete process.env[k]
              : (process.env[k] = before[k]);
        }
      },
    );
    await t.test(
      "admin variants: delete, keep ordered ones hidden, last bestellbar variant of a published product, colour x size generator",
      async () => {
        const [p] =
          await sql`INSERT INTO products(title,brand,source_url,visibility,publication) VALUES('Variant Test','—','','catalog','draft') RETURNING id`;
        const mk = async (size: string, color: string) =>
          (
            await sql`INSERT INTO shop_variants(product_id,size,color,availability) VALUES(${p.id},${size},${color},'available') RETURNING id`
          )[0].id as number;
        const placeholder = await mk("Noch festzulegen", "");
        const ordered = await mk("M", "Hell");
        const spare = await mk("L", "Dunkel");
        // The spare variant sits in a customer's cart and is linked to a photo.
        await sql`INSERT INTO shop_cart(user_id,variant_id,quantity) VALUES(${A.id},${spare},1)`;
        const [photo] =
          await sql`INSERT INTO shop_media(product_id,variant_id,bucket,object_path,alt,position,kind) VALUES(${p.id},${spare},'fashion-catalog','t/variant.webp','x',0,'product') RETURNING id`;
        // The ordered variant is part of an existing order.
        const [order] =
          await sql`INSERT INTO shop_orders(number,user_id,address,idempotency_key,request_hash) VALUES('VAR-TEST-1',${A.id},'{}','var-test','h') RETURNING id`;
        await sql`INSERT INTO shop_order_items(order_id,product_id,variant_id,title,size,color,sku,quantity) VALUES(${order.id},${p.id},${ordered},'Variant Test','M','Hell','',1)`;

        await assert.rejects(() => C.deleteVariant(A, p.id, placeholder), /Admin|403|Zugriff|nicht/i);
        await assert.rejects(() => C.deleteVariant(admin, p.id, 999999), /nicht gefunden/);

        const r1 = await C.deleteVariant(admin, p.id, placeholder);
        assert.equal(r1.deleted, true);
        const r2 = await C.deleteVariant(admin, p.id, spare);
        assert.equal(r2.deleted, true);
        assert.equal(r2.removed_cart_lines, 1);
        assert.equal(
          (await sql`SELECT count(*)::int AS n FROM shop_cart WHERE variant_id=${spare}`)[0].n,
          0,
        );
        assert.equal(
          (await sql`SELECT variant_id FROM shop_media WHERE id=${photo.id}`)[0].variant_id,
          null,
        );
        const r3 = await C.deleteVariant(admin, p.id, ordered);
        assert.equal(r3.deleted, false);
        assert.equal(r3.hidden, true);
        assert.equal(
          (await sql`SELECT availability FROM shop_variants WHERE id=${ordered}`)[0].availability,
          "unavailable",
        );
        // The order line still points at the kept variant.
        assert.equal(
          (await sql`SELECT count(*)::int AS n FROM shop_order_items WHERE variant_id=${ordered}`)[0].n,
          1,
        );

        // Generator: replace removes the old ones (ordered one is hidden, not deleted), then colour x size.
        await assert.rejects(() => C.generateVariants(admin, p.id, {}), /Farbe oder eine Größe/);
        await assert.rejects(
          () => C.generateVariants(admin, p.id, { colors: "A", purchase_cny: -1 }),
          /Einkaufspreis/,
        );
        const g = await C.generateVariants(admin, p.id, {
          colors: "Schwarz, Weiß",
          sizes: ["S", "M", "L"],
          purchase_cny: 120,
          replace: true,
        });
        assert.equal(g.created, 6);
        const rows =
          await sql`SELECT size,color,purchase_fen,price_approved,availability FROM shop_variants WHERE product_id=${p.id} AND availability<>'unavailable' ORDER BY color,size`;
        assert.equal(rows.length, 6);
        assert.ok(rows.every((v) => Number(v.purchase_fen) === 12000 && v.price_approved));
        // Running it again creates nothing new.
        const again = await C.generateVariants(admin, p.id, { colors: "Schwarz", sizes: "S, M" });
        assert.equal(again.created, 0);

        // A published product must keep at least one variant customers can order.
        await sql`INSERT INTO shop_media(product_id,bucket,object_path,alt,position,kind) VALUES(${p.id},'fashion-catalog','t/cover.webp','x',1,'product')`;
        await sql`UPDATE products SET publication='published' WHERE id=${p.id}`;
        const live = await sql`SELECT id FROM shop_variants WHERE product_id=${p.id} AND availability<>'unavailable' ORDER BY id`;
        for (const v of live.slice(0, -1)) await C.deleteVariant(admin, p.id, v.id);
        await assert.rejects(
          () => C.deleteVariant(admin, p.id, live[live.length - 1].id),
          /mindestens eine bestellbare Variante/,
        );
        assert.equal(
          (await sql`SELECT count(*)::int AS n FROM shop_variants WHERE id=${live[live.length - 1].id}`)[0].n,
          1,
        );
      },
    );
    await t.test(
      "admin routes: deleting a variant or an image must not archive the product",
      async () => {
        const { createSession } = await import("../src/lib/server/auth");
        const { commerceRoute } = await import("../src/lib/commerce/api");
        const token = await createSession(admin.id);
        const call = (method: string, path: string[], body?: unknown) =>
          commerceRoute(
            new Request(`http://localhost/api/commerce/${path.join("/")}`, {
              method,
              headers: {
                cookie: `fo_session=${token}`,
                "content-type": "application/json",
              },
              body: body ? JSON.stringify(body) : undefined,
            }),
            path,
          );
        const [p] =
          await sql`INSERT INTO products(title,brand,source_url,visibility,publication) VALUES('Route Test','—','','catalog','draft') RETURNING id`;
        const gen = await call("POST", ["products", String(p.id), "variants", "generate"], {
          colors: "Rot, Blau",
          sizes: "M",
        });
        assert.equal(gen.status, 200);
        const [v] =
          await sql`SELECT id FROM shop_variants WHERE product_id=${p.id} ORDER BY id LIMIT 1`;
        const [m] =
          await sql`INSERT INTO shop_media(product_id,bucket,object_path,alt,position,kind) VALUES(${p.id},'fashion-catalog','t/route.webp','x',0,'product') RETURNING id`;

        const delVariant = await call("DELETE", ["products", String(p.id), "variants", String(v.id)]);
        assert.equal(delVariant.status, 200);
        assert.equal(
          (await sql`SELECT count(*)::int AS n FROM shop_variants WHERE product_id=${p.id}`)[0].n,
          1,
        );
        const delMedia = await call("DELETE", ["products", String(p.id), "media", String(m.id)]);
        assert.equal(delMedia.status, 200);
        assert.equal(
          (await sql`SELECT count(*)::int AS n FROM shop_media WHERE product_id=${p.id}`)[0].n,
          0,
        );
        const [still] = await sql`SELECT publication,active FROM products WHERE id=${p.id}`;
        assert.equal(still.publication, "draft");
        assert.equal(Number(still.active), 1);

        // Only the plain product path archives it.
        const delProduct = await call("DELETE", ["products", String(p.id)]);
        assert.equal(delProduct.status, 200);
        assert.equal(
          (await sql`SELECT publication FROM products WHERE id=${p.id}`)[0].publication,
          "archived",
        );
      },
    );
    await t.test(
      "AI listing wizard: draft import, curated variants, public content, model shot, never touched by the sorting agent",
      async () => {
        const L = await import("../src/lib/commerce/listing");
        const sharp = (await import("sharp")).default;
        const os = await import("node:os");
        const nodePath = await import("node:path");
        const keys = [
          "GEMINI_API_KEY",
          "LISTING_AI_API_KEY",
          "LISTING_AI_IMAGE_CONSENT",
          "LISTING_AI_MODEL",
          "LISTING_IMAGE_MODEL",
          "SUPABASE_INTERNAL_URL",
          "SUPABASE_SERVICE_ROLE_KEY",
          "MEDIA_WEB_CACHE",
          "CATALOG_AGENT_PROVIDER",
          "CATALOG_AGENT_IMAGE_CONSENT",
          "CATALOG_AGENT_MIN_PRODUCT_ID",
          "CATALOG_AGENT_MIN_MEDIA_ID",
          "CATALOG_AGENT_API_KEY",
        ];
        const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
        const originalFetch = globalThis.fetch;
        const cacheDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "listing-"));
        const png = await sharp({
          create: { width: 64, height: 64, channels: 3, background: "#336699" },
        })
          .png()
          .toBuffer();
        const geminiBodies: any[] = [];
        try {
          Object.assign(process.env, {
            GEMINI_API_KEY: "test-not-a-real-key",
            LISTING_AI_IMAGE_CONSENT: "gemini",
            LISTING_AI_MODEL: "test-text-model",
            LISTING_IMAGE_MODEL: "test-image-model",
            SUPABASE_INTERNAL_URL: "http://storage.test",
            SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
            MEDIA_WEB_CACHE: cacheDir,
          });
          delete process.env.LISTING_AI_API_KEY;
          globalThis.fetch = (async (input: any, init: any) => {
            const target = String(input);
            if (target.includes("generativelanguage")) {
              const body = JSON.parse(init.body);
              geminiBodies.push({ target, body });
              if (target.includes("test-image-model"))
                return new Response(
                  JSON.stringify({
                    candidates: [
                      {
                        content: {
                          parts: [
                            {
                              inlineData: {
                                mimeType: "image/png",
                                data: png.toString("base64"),
                              },
                            },
                          ],
                        },
                      },
                    ],
                  }),
                );
              const system = body.systemInstruction.parts[0].text as string;
              const answer = system.includes("copywriter")
                ? {
                    title: "Oversized T-Shirt mit Vogel-Print",
                    tagline: "Relaxed-Fit-Shirt. Rundhals.",
                    description: "Lockeres Shirt.",
                    highlights: ["Rundhals"],
                    care: ["Bitte das Pflegeetikett im Kleidungsstück beachten."],
                    faq: [{ q: "Wann zahle ich?", a: "Nach dem Angebot." }],
                  }
                : {
                    product_type: "T-Shirt",
                    category_id: "tshirts",
                    gender: "men",
                    colors: [{ name: "Schwarz", hex: "#111111" }],
                  };
              return new Response(
                JSON.stringify({
                  candidates: [
                    { content: { parts: [{ text: JSON.stringify(answer) }] } },
                  ],
                }),
              );
            }
            if (target.startsWith("http://storage.test/storage/v1/"))
              return init?.method === "POST"
                ? new Response("{}")
                : new Response(new Uint8Array(png));
            throw new Error("Unerwarteter Netzwerkzugriff im Test: " + target);
          }) as typeof fetch;

          // 1. Nur Admins; Import-Job mit dem Beispiel-Taobao-Link inkl. Tracking-Parametern.
          await assert.rejects(
            () => L.listingRoute(A, "GET", ["config"], {}),
            /Admin/,
          );
          const jobId = await L.startListingImport(admin, {
            url: "https://seller.x.yupoo.com/albums/777001?uid=1&isSubCate=false&referrercate=5188942",
            procurement_url:
              "https://item.taobao.com/item.htm?spm=a213gs.v2success.0.0.6d454831c91qV8&id=1053760707180",
          });
          assert.equal(
            await L.startListingImport(admin, {
              url: "https://seller.x.yupoo.com/albums/777001",
            }),
            jobId,
          );
          await assert.rejects(() =>
            L.startListingImport(admin, {
              url: "https://seller.x.yupoo.com/albums/777002",
              procurement_url: "https://evil.example/item.htm?id=1",
            }),
          );
          const token = "00000000-0000-4000-8000-000000000a01";
          await sql`UPDATE shop_jobs SET status='running',token=${token},lease_until=now()+interval '3 minutes' WHERE id=${jobId}`;
          const [job] = await sql`SELECT * FROM shop_jobs WHERE id=${jobId}`;
          assert.equal(job.payload.wizard, true);
          const result = await I.runImport(
            job,
            token,
            async () => I.parseAlbum(fixture, job.payload.url),
            async (u: string) => "wizard/" + u.split("/").pop(),
          );
          assert.equal(result.already_existed, false);
          const status = await L.listingJobStatus(admin, jobId);
          assert.equal(status.status, "done");
          assert.equal(status.result.product_id, result.product_id);
          const [draft] =
            await sql`SELECT * FROM products WHERE id=${result.product_id}`;
          assert.equal(draft.publication, "draft");
          assert.equal(draft.listing_origin, "wizard");
          assert.equal(draft.visibility, "catalog");
          assert.equal(draft.price_cny, 200);
          assert.equal(
            draft.procurement_url,
            "https://item.taobao.com/item.htm?id=1053760707180",
          );
          assert.equal(
            (await sql`SELECT id FROM shop_variants WHERE product_id=${draft.id}`)
              .length,
            0,
          );
          assert.equal(
            (
              await sql`SELECT id FROM shop_catalog_audits WHERE input @> ${sql.json([{ id: draft.id }])}`
            ).length,
            0,
          );

          // 2. KI-Vorschläge und Texte (Gemini ist ein Fake).
          const analysis = (await L.analyzeListing(admin, draft.id)).analysis;
          assert.equal(analysis.category_id, "tshirts");
          assert.equal(analysis.colors[0].name, "Schwarz");
          const { copy } = await L.generateListingCopy(admin, draft.id, {
            product_type: "T-Shirt",
            category_id: "tshirts",
            gender: "men",
            colors: analysis.colors,
            sizes: ["S", "M", "L"],
          });
          assert.equal(copy.title, "Oversized T-Shirt mit Vogel-Print");
          const textRequest = geminiBodies.find((g) =>
            g.target.includes("test-text-model"),
          );
          assert.ok(
            textRequest.body.contents[0].parts.some((p: any) => p.inlineData),
          );

          // 3. Speichern: Farben × Größen, Entwurf bleibt unsichtbar, Veröffentlichung braucht Preis.
          const payload = {
            copy: { ...copy, description: "Lockeres Shirt.\n\nMit Print." },
            brand: "",
            gender: "men",
            category_id: "tshirts",
            colors: [
              { name: "Schwarz", hex: "#111111" },
              { name: "Weiß", hex: "#ffffff" },
            ],
            sizes: ["S", "M", "L"],
            purchase_cny: 99,
            availability: "available",
            price_approved: true,
            procurement_url: draft.procurement_url,
            publication: "draft",
          };
          const applied = await L.applyListing(admin, draft.id, payload);
          assert.equal(applied.product.variants.length, 6);
          assert.equal(applied.product.listing.faq.length, 1);
          assert.equal(applied.product.listing.colors[1].hex, "#ffffff");
          assert.deepEqual(applied.product.category_ids, ["tshirts"]);
          assert.equal(applied.warnings.length, 0);
          await assert.rejects(() => C.accessible(getSql(), A, draft.id));
          await assert.rejects(
            () =>
              L.applyListing(admin, draft.id, {
                ...payload,
                purchase_cny: null,
                publication: "published",
              }),
            /Einkaufspreis/,
          );
          await L.applyListing(admin, draft.id, {
            ...payload,
            publication: "published",
          });
          const customer = await C.productDTO(
            getSql(),
            A,
            await C.accessible(getSql(), A, draft.id),
          );
          assert.equal("procurement_url" in customer, false);
          assert.equal("purchase_fen" in customer.variants[0], false);
          assert.equal(customer.listing.tagline, "Relaxed-Fit-Shirt. Rundhals.");
          const listPage = await C.catalog(A, new URLSearchParams());
          const inList = listPage.products.find((p: any) => p.id === draft.id);
          assert.ok(inList);
          assert.deepEqual(inList.listing, {});

          // 4. Alte Variante im Warenkorb bleibt als "nicht lieferbar" erhalten, unbenutzte wird entfernt.
          const [inCart] =
            await sql`SELECT id FROM shop_variants WHERE product_id=${draft.id} AND size='M' AND color='Schwarz'`;
          await O.changeCart(A, { variant_id: inCart.id, quantity: 1 });
          await L.applyListing(admin, draft.id, {
            ...payload,
            sizes: ["S", "L"],
            publication: "published",
          });
          const variants =
            await sql`SELECT size,color,availability FROM shop_variants WHERE product_id=${draft.id} ORDER BY id`;
          assert.equal(variants.length, 5);
          assert.equal(
            variants.find((v) => v.size === "M" && v.color === "Schwarz")
              ?.availability,
            "unavailable",
          );
          assert.equal(
            variants.some((v) => v.size === "M" && v.color === "Weiß"),
            false,
          );

          // 5. Der Sortieragent fasst Assistenten-Produkte nicht an.
          Object.assign(process.env, {
            CATALOG_AGENT_PROVIDER: "gemini",
            CATALOG_AGENT_IMAGE_CONSENT: "gemini",
            CATALOG_AGENT_MIN_PRODUCT_ID: "0",
            CATALOG_AGENT_MIN_MEDIA_ID: "0",
            CATALOG_AGENT_API_KEY: "test-not-a-real-key",
          });
          const G = await import("../src/lib/commerce/catalog-agent");
          await G.queueCatalogAudit(admin);
          assert.equal(
            (
              await sql`SELECT id FROM shop_catalog_audits WHERE input @> ${sql.json([{ id: draft.id }])}`
            ).length,
            0,
          );

          // 6. Model-Foto: Referenzfotos + Prompt gehen an Gemini, Ergebnis wird als KI-Foto gespeichert.
          const refs = await sql`SELECT id FROM shop_media WHERE product_id=${draft.id} ORDER BY position,id`;
          await assert.rejects(
            () =>
              L.createModelShot(admin, draft.id, {
                prompt: "Ein ausreichend langer Prompt für das Model-Foto.",
                reference_media_ids: [],
              }),
            /Referenzfoto/,
          );
          const shot = await L.createModelShot(admin, draft.id, {
            prompt: "A studio photo of a model wearing the product.",
            reference_media_ids: [refs[0].id],
            aspect_ratio: "4:5",
          });
          assert.equal(shot.media.kind, "ai_model");
          const imageRequest = geminiBodies.find((g) =>
            g.target.includes("test-image-model"),
          );
          assert.equal(
            imageRequest.body.generationConfig.imageConfig.aspectRatio,
            "4:5",
          );
          assert.ok(
            imageRequest.body.contents[0].parts[0].text.includes("IMPORTANT RULES"),
          );
          assert.equal(imageRequest.body.contents[0].parts.length, 2);
          const after = await C.productDTO(
            getSql(),
            admin,
            (await sql`SELECT * FROM products WHERE id=${draft.id}`)[0],
          );
          assert.ok(after.media.some((m: any) => m.kind === "ai_model"));
          // Fremdes Referenzfoto wird abgelehnt.
          const [foreign] =
            await sql`SELECT id FROM shop_media WHERE product_id<>${draft.id} LIMIT 1`;
          await assert.rejects(
            () =>
              L.createModelShot(admin, draft.id, {
                prompt: "A studio photo of a model wearing the product.",
                reference_media_ids: [foreign.id],
              }),
            /nicht zu diesem Produkt/,
          );
          await L.deleteProductMedia(admin, draft.id, shot.media.id);
          await assert.rejects(() =>
            L.deleteProductMedia(admin, draft.id, shot.media.id),
          );
          await assert.rejects(() => L.deleteProductMedia(A, draft.id, refs[0].id));
        } finally {
          globalThis.fetch = originalFetch;
          for (const k of keys)
            before[k] === undefined
              ? delete process.env[k]
              : (process.env[k] = before[k]);
          fs.rmSync(cacheDir, { recursive: true, force: true });
        }
      },
    );
    await t.test(
      "restricted runtime role cannot change schema or migration ledger",
      async () => {
        await promisify(execFile)(
          process.execPath,
          ["--import", "tsx", "scripts/setup-commerce.ts", "--roles"],
          {
            env: {
              ...process.env,
              MIGRATION_DATABASE_URL: url!,
              SHOP_DB_APP_PASSWORD: "local-test-app-password",
              SHOP_DB_MIGRATION_PASSWORD: "local-test-migration-password",
            },
          },
        );
        const parsed = new URL(url!);
        parsed.username = "fashion_shop_app";
        parsed.password = "local-test-app-password";
        const restricted = postgres(parsed.toString(), { max: 1 });
        try {
          await restricted`SELECT id FROM shop_orders LIMIT 1`;
          await assert.rejects(() =>
            restricted.unsafe("CREATE TABLE forbidden_table(id integer)"),
          );
          await assert.rejects(
            () =>
              restricted`INSERT INTO shop_migrations(version,checksum) VALUES('forbidden','bad')`,
          );
          const [grants] =
            await restricted`SELECT has_table_privilege('anon','public.gram_messages','SELECT') AS visible`;
          assert.equal(grants.visible, false);
        } finally {
          await restricted.end();
        }
      },
    );
    await sql.end();
    await getSql().end();
    await (await import("../src/lib/commerce/core")).closeCommerce();
  },
);
