/** Isolated staging pilot. Never sends money or supplier messages. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { database, closeCommerce } from "../src/lib/commerce/core";
import { storageRequest, signedMedia } from "../src/lib/commerce/storage";
import { queueImports, runImport } from "../src/lib/commerce/imports";
import {
  changeCart,
  cart,
  submitCart,
  createOffer,
  acceptOffer,
  orderDetail,
} from "../src/lib/commerce/orders";
import {
  createPayment,
  submitTxid,
  confirmPayment,
} from "../src/lib/commerce/payments";
import {
  createPurchases,
  purchases,
  updatePurchase,
  shipment,
  deliver,
} from "../src/lib/commerce/procurement";
import { commerceRoute } from "../src/lib/commerce/api";
import { createSession } from "../src/lib/server/auth";
import { getSql } from "../src/lib/server/db";
import type { User } from "../src/lib/types";
async function main() {
  if (
    process.env.STAGING_COMMERCE !== "1" ||
    !new URL(process.env.DATABASE_URL || "http://invalid").hostname.includes(
      "stage",
    ) ||
    !process.env.STORAGE_PRIVATE_BUCKET?.endsWith("-stage")
  )
    throw new Error("Explicit isolated staging configuration required.");
  const sql = database(),
    tag = crypto.randomBytes(5).toString("hex");
  const [a, b] =
    await sql`INSERT INTO users(name,password_hash,role,handle) VALUES(${"STAGING PILOT CUSTOMER " + tag},'disabled-login','friend',${"stage-c-" + tag}),(${"STAGING PILOT ADMIN " + tag},'disabled-login','admin',${"stage-a-" + tag}) RETURNING id,name,role`;
  const customer = {
      id: a.id,
      name: a.name,
      role: "friend",
      share_all_friends: 0,
      avatar_initials: "ST",
    } as User,
    admin = {
      id: b.id,
      name: b.name,
      role: "admin",
      share_all_friends: 0,
      avatar_initials: "ST",
    } as User;
  const [legacy] =
    await sql`SELECT * FROM shop_media WHERE bucket='legacy' LIMIT 1`;
  if (!legacy) throw new Error("Restored media fixture missing.");
  const bytes = await fs.readFile(
    path.join("/data/cache", path.basename(legacy.object_path)),
  );
  const mime = bytes[0] === 255 ? "image/jpeg" : "image/png";
  const objectPath = `pilot/${tag}/image.${mime === "image/jpeg" ? "jpg" : "png"}`,
    bucket = process.env.STORAGE_PRIVATE_BUCKET!;
  await storageRequest(`/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": mime, "x-upsert": "true" },
    body: new Uint8Array(bytes),
  });
  const signed = await signedMedia(bucket, objectPath);
  const download = await storageRequest(signed.replace(/^\/storage\/v1/, ""));
  if ((await download.arrayBuffer()).byteLength !== bytes.byteLength)
    throw new Error("Storage roundtrip mismatch.");
  const [source] =
    await sql`SELECT split_part(source_url,'#',1) AS source_url FROM products WHERE visibility='catalog' AND source_url LIKE 'https://%yupoo.com/albums/%' GROUP BY split_part(source_url,'#',1) ORDER BY count(*) DESC LIMIT 1`;
  if (!source) throw new Error("No album for live import.");
  const fixtureMode = process.argv.includes("--fixture-import");
  let job: Record<string, any> | undefined;
  if (fixtureMode) {
    const cached =
      await sql`SELECT m.object_path FROM shop_media m JOIN products p ON p.id=m.product_id WHERE m.bucket='legacy' AND split_part(p.source_url,'#',1)=${source.source_url} ORDER BY p.id LIMIT 3`;
    if (cached.length < 2)
      throw new Error(
        "Need multiple restored gallery images for fixture pilot.",
      );
    const token = crypto.randomUUID();
    const [record] =
      await sql`INSERT INTO shop_jobs(user_id,kind,payload,status,token,lease_until) VALUES(${customer.id},'import',${sql.json({ url: source.source_url })},'running',${token},now()+interval '3 minutes') RETURNING *`;
    const result = await runImport(
      record,
      token,
      async () => ({
        url: source.source_url,
        title: "STAGING restored gallery fixture",
        brand: "STAGING",
        category: "Shoes",
        description:
          "STAGING fixture from restored media; external source not asserted live.",
        images: cached.map((_, i) => "fixture:" + i),
        variant_hints: { sizes: [], colors: [] },
        price_cny: 100,
        warnings: ["STAGING fixture import; not a live supplier verification."],
      }),
      async (image, _referer, targetBucket, key) => {
        const index = Number(image.split(":")[1]);
        const content = await fs.readFile(
          path.join("/data/cache", path.basename(cached[index].object_path)),
        );
        const type = content[0] === 255 ? "image/jpeg" : "image/png";
        const file =
          key +
          "/" +
          crypto.createHash("sha256").update(content).digest("hex") +
          "." +
          (type === "image/jpeg" ? "jpg" : "png");
        await storageRequest(`/object/${targetBucket}/${file}`, {
          method: "POST",
          headers: { "Content-Type": type, "x-upsert": "true" },
          body: new Uint8Array(content),
        });
        return file;
      },
    );
    job = { status: "done", result };
  } else {
    const [jobId] = await queueImports(customer, [
      source.source_url.split("#")[0],
    ]);
    for (let attempt = 0; attempt < 120; attempt++) {
      [job] =
        await sql`SELECT status,result,error FROM shop_jobs WHERE id=${jobId}`;
      if (job?.status === "done" || job?.status === "failed") break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (job?.status !== "done")
      throw new Error(
        "Live import did not complete: " + (job?.error || job?.status),
      );
  }
  const productId = job.result.product_id;
  const [mediaCount] =
    await sql`SELECT count(*)::int AS n FROM shop_media WHERE product_id=${productId}`;
  if (!mediaCount.n) throw new Error("Live import returned no cached images.");
  const [p] =
    await sql`INSERT INTO products(title,brand,source_url,visibility,publication) VALUES('STAGING pilot catalog','STAGING','','catalog','published') RETURNING id`;
  await sql`INSERT INTO shop_media(product_id,bucket,object_path,alt) VALUES(${p.id},${bucket},${objectPath},'STAGING pilot image')`;
  const [v1] =
    await sql`SELECT id FROM shop_variants WHERE product_id=${productId} ORDER BY id LIMIT 1`;
  const [v2] =
    await sql`INSERT INTO shop_variants(product_id,size,color,purchase_fen,availability,price_approved) VALUES(${p.id},'M','Black',10000,'available',true) RETURNING id`;
  await changeCart(customer, { variant_id: v1.id, quantity: 1 });
  await changeCart(customer, { variant_id: v2.id, quantity: 1 });
  const c = await cart(customer);
  const orderId = await submitCart(
    customer,
    {
      version: c.version,
      address: {
        name: "STAGING ONLY",
        street: "Test address 1",
        zip: "00000",
        city: "STAGING",
        country: "DE",
      },
    },
    "staging-pilot-" + tag,
  );
  const initial = await orderDetail(admin, orderId);
  await createOffer(admin, orderId, {
    shipping_cents: 500,
    delivery_note: "STAGING ONLY - no real delivery",
    lines: initial.items.map((i, index) => ({
      item_id: i.id,
      size: "M",
      color: "Black",
      unit_cents: 4700,
      purchase_fen: 10000,
      supplier: "STAGING supplier " + (index ? "B" : "A"),
    })),
  });
  const offer = (await orderDetail(customer, orderId)).offers[0];
  await acceptOffer(customer, orderId, offer.id);
  const [method] =
    await sql`INSERT INTO shop_payment_methods(currency,network,address,decimals,enabled) VALUES('BTC','bitcoin','STAGING-NO-REAL-PAYMENT',8,true) ON CONFLICT(currency,network) DO UPDATE SET address=excluded.address,enabled=true RETURNING id`;
  const paymentId = await createPayment(customer, orderId, method.id);
  await submitTxid(
    customer,
    orderId,
    paymentId,
    crypto.createHash("sha256").update(tag).digest("hex"),
  );
  const payment = (await orderDetail(customer, orderId)).payments[0];
  await confirmPayment(admin, orderId, paymentId, {
    verified_network: "bitcoin",
    verified_address: payment.address,
    actual_atoms: payment.amount_atoms,
    note: "STAGING synthetic reconciliation; no funds moved",
  });
  await createPurchases(admin, orderId);
  const pos = await purchases(admin, orderId);
  if (pos.length !== 2) throw new Error("Expected two supplier orders.");
  const token = await createSession(admin.id);
  for (const po of pos) {
    const response = await commerceRoute(
      new Request(
        `http://localhost/api/commerce/admin/orders/${orderId}/purchases/${po.id}/export?format=xlsx`,
        { headers: { cookie: `fo_session=${token}` } },
      ),
      [
        "admin",
        "orders",
        String(orderId),
        "purchases",
        String(po.id),
        "export",
      ],
    );
    if (
      response.status !== 200 ||
      (await response.arrayBuffer()).byteLength < 1000
    )
      throw new Error("Supplier XLSX export failed.");
    await updatePurchase(admin, orderId, po.id, {
      status: "sent",
      recipient: "STAGING - no message sent",
    });
    await updatePurchase(admin, orderId, po.id, {
      status: "confirmed",
      external_reference: "STAGING-" + po.id,
    });
    await shipment(admin, orderId, po.id, {
      carrier: "STAGING",
      tracking: "STAGING-" + po.id,
      items: po.items.map((i: Record<string, any>) => ({
        purchase_item_id: i.id,
        quantity: i.quantity,
      })),
    });
  }
  const d = await orderDetail(customer, orderId);
  for (const s of d.shipments) await deliver(admin, orderId, s.id);
  const final = await orderDetail(customer, orderId);
  if (final.status !== "completed") throw new Error("Pilot not completed.");
  await sql`UPDATE shop_payment_methods SET enabled=false WHERE id=${method.id}`;
  console.log(
    JSON.stringify({
      storage_roundtrip: true,
      live_import: !fixtureMode,
      fixture_import: fixtureMode,
      import_images: mediaCount.n,
      mixed_checkout: true,
      offer_accepted: true,
      coinbase_invoice: true,
      synthetic_payment_reconciled: true,
      supplier_exports: pos.length,
      shipments: final.shipments.length,
      status: final.status,
      real_money_sent: false,
      supplier_messages_sent: false,
    }),
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeCommerce();
    await getSql().end();
  });
