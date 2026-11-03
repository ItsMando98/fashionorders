/**
 * Legacy-Migration: items (stage cart/submitted) -> Shop-System
 *
 * - stage = "submitted"  -> je User eine Order (Status "paid") + order_items Snapshots
 * - stage = "cart"       -> cart_items; Produkte werden dedupliziert pro URL angelegt
 *
 * Idempotent-Strategie: bereits migrierte Items werden uebersprungen
 * (Markierung via admin_notes-Praefix "[migrated]"). Vorher Backup machen!
 *
 * Usage:
 *   node --import tsx scripts/migrate-legacy-orders.ts
 */
import { eq } from "drizzle-orm";
import { db, ensureDb, items, products, cartItems, orders, orderItems, users } from "../src/lib/server/db";
import { getFeeSettings, getShopSettings, priceLine, computeOrderTotals } from "../src/lib/server/pricing";
import type { User } from "../src/lib/types";

const MIGRATED_MARK = "[migrated]";
const nowUtc = () => new Date().toISOString().slice(0, 19).replace("T", " ");

async function productForUrl(url: string, item: typeof items.$inferSelect): Promise<number> {
  const existing = (
    await db.select().from(products).where(eq(products.sourceUrl, url))
  )[0];
  if (existing) return existing.id;

  const inserted = (
    await db
      .insert(products)
      .values({
        title: item.title.slice(0, 300),
        brand: item.brand || "—",
        category: item.category || "Apparel / Item",
        availableSizes: item.availableSizes || "",
        description: item.description || "",
        priceCny: item.priceCny ?? null,
        localImage: item.localImage || "",
        sourcePlatform: item.sourcePlatform || "Yupoo",
        seller: item.seller || "",
        sourceUrl: url,
        weidianUrl: item.weidianUrl || "",
        active: 1,
      })
      .returning()
  )[0];
  return inserted.id;
}

async function main() {
  await ensureDb();
  const feeSettings = await getFeeSettings();
  const shopSettings = await getShopSettings();

  const allUsers = await db.select().from(users);
  const allItems = await db.select().from(items);

  let migratedOrders = 0;
  let migratedCartLines = 0;
  let skipped = 0;

  for (const user of allUsers) {
    const member: User = {
      id: user.id,
      name: user.name,
      role: user.role as "admin" | "friend",
      avatar_initials: user.avatarInitials,
      share_all_friends: user.shareAllFriends,
      custom_item_fixed_eur: user.customItemFixedEur,
      custom_item_percent: user.customItemPercent,
      custom_haul_percent: user.customHaulPercent,
    };

    const userItems = allItems.filter(
      (it) => it.userId === user.id && !(it.adminNotes || "").startsWith(MIGRATED_MARK)
    );
    if (userItems.length === 0) continue;

    const submitted = userItems.filter((it) => it.stage === "submitted");
    const inCart = userItems.filter((it) => it.stage === "cart");

    // --- submitted -> eine Order mit Snapshots ---
    if (submitted.length > 0) {
      const lines = submitted.map((it) => ({
        raw: it,
        priced: priceLine(it.priceCny, it.quantity, member, feeSettings),
      }));
      const totals = computeOrderTotals(
        lines.map((l) => l.priced),
        member,
        feeSettings,
        shopSettings.shipping_eur
      );

      const year = new Date().getFullYear();
      const ts = nowUtc();

      await db.transaction(async (tx) => {
        const inserted = (
          await tx
            .insert(orders)
            .values({
              orderNumber: `FS-${year}-PENDING`,
              userId: user.id,
              status: "paid", // Annahme: Legacy-Orders waren bereits beauftragt
              shipName: user.name,
              subtotalCny: totals.subtotal_cny,
              subtotalEur: totals.subtotal_eur,
              itemFeesEur: totals.item_fees_eur,
              haulFeePercent: totals.haul_fee_percent,
              haulFeeEur: totals.haul_fee_eur,
              shippingEur: totals.shipping_eur,
              totalEur: totals.total_eur,
              adminNotes: "Migrated from legacy items",
              createdAt: ts,
              updatedAt: ts,
            })
            .returning()
        )[0];

        const orderNumber = `FS-${year}-${String(inserted.id).padStart(4, "0")}`;
        await tx.update(orders).set({ orderNumber }).where(eq(orders.id, inserted.id));

        for (const { raw, priced } of lines) {
          const productId = raw.url ? await productForUrl(raw.url, raw) : null;
          await tx.insert(orderItems).values({
            orderId: inserted.id,
            productId,
            title: raw.title,
            chosenSize: raw.chosenSize || "",
            colorVariant: raw.colorVariant || "",
            quantity: priced.quantity,
            priceCny: priced.price_cny,
            baseEur: priced.base_price_eur,
            feeEur: priced.item_fee_eur,
            lineTotalEur: priced.line_total_eur,
            localImage: raw.localImage || "",
            seller: raw.seller || "",
            sourceUrl: raw.url || "",
            weidianUrl: raw.weidianUrl || "",
            fulfillmentStatus: (raw.orderStatus || "pending").toLowerCase(),
            trackingNumber: raw.trackingNumber || "",
            createdAt: ts,
          });
        }

        // Legacy-Items als migriert markieren (bleiben read-only erhalten)
        for (const raw of submitted) {
          await tx
            .update(items)
            .set({ adminNotes: `${MIGRATED_MARK} ${raw.adminNotes || ""}`.trim() })
            .where(eq(items.id, raw.id));
        }
      });

      migratedOrders++;
      console.log(`order migrated for ${user.name} (${submitted.length} items)`);
    }

    // --- cart -> cart_items (+ Produkte) ---
    for (const raw of inCart) {
      try {
        const productId = raw.url ? await productForUrl(raw.url, raw) : null;
        if (!productId) {
          skipped++;
          continue;
        }
        await db.insert(cartItems).values({
          userId: user.id,
          productId,
          chosenSize: raw.chosenSize || "",
          colorVariant: raw.colorVariant || "",
          quantity: Math.max(1, raw.quantity || 1),
        });
        await db
          .update(items)
          .set({ adminNotes: `${MIGRATED_MARK} ${raw.adminNotes || ""}`.trim() })
          .where(eq(items.id, raw.id));
        migratedCartLines++;
      } catch (err) {
        skipped++;
        console.log(`skip cart item ${raw.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(
    `Done: ${migratedOrders} orders migrated, ${migratedCartLines} cart lines migrated, ${skipped} skipped.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
