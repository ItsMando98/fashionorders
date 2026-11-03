import { and, desc, eq } from "drizzle-orm";
import { db, ensureDb, cartItems, orders, orderItems, products, users } from "./db";
import type { OrderItemRow, OrderRow } from "./schema";
import { PublicError } from "./http";
import { getFeeSettings, getShopSettings, priceLine, computeOrderTotals } from "./pricing";
import type {
  AdminShopOrder,
  AdminShopOrderItem,
  CartLine,
  OrderTotals,
  ShopOrder,
  ShopOrderItem,
  ShopOrderStatus,
  User,
} from "@/lib/types";

export const ORDER_STATUSES: ShopOrderStatus[] = [
  "awaiting_payment",
  "paid",
  "ordering",
  "shipped",
  "delivered",
  "cancelled",
];

const nowUtc = () => new Date().toISOString().slice(0, 19).replace("T", " ");

// ---------------------------------------------------------------------------
// Mapping: Kunden-Sicht (ohne Seller) vs. Admin-Sicht (mit Seller)
// ---------------------------------------------------------------------------

function toShopOrderItem(row: OrderItemRow): ShopOrderItem {
  return {
    id: row.id,
    order_id: row.orderId,
    product_id: row.productId ?? null,
    title: row.title,
    chosen_size: row.chosenSize || "",
    color_variant: row.colorVariant || "",
    quantity: row.quantity,
    price_cny: row.priceCny ?? null,
    base_eur: row.baseEur ?? null,
    fee_eur: row.feeEur ?? 0,
    line_total_eur: row.lineTotalEur ?? 0,
    local_image: row.localImage || "",
    fulfillment_status: row.fulfillmentStatus || "pending",
    tracking_number: row.trackingNumber || "",
  };
}

function toAdminShopOrderItem(row: OrderItemRow): AdminShopOrderItem {
  return {
    ...toShopOrderItem(row),
    seller: row.seller || "",
    source_url: row.sourceUrl || "",
    weidian_url: row.weidianUrl || "",
  };
}

function baseOrder(row: OrderRow): ShopOrder {
  return {
    id: row.id,
    order_number: row.orderNumber,
    user_id: row.userId,
    status: row.status as ShopOrderStatus,
    ship_name: row.shipName || "",
    ship_street: row.shipStreet || "",
    ship_zip: row.shipZip || "",
    ship_city: row.shipCity || "",
    ship_country: row.shipCountry || "",
    subtotal_cny: row.subtotalCny ?? 0,
    subtotal_eur: row.subtotalEur ?? 0,
    item_fees_eur: row.itemFeesEur ?? 0,
    haul_fee_percent: row.haulFeePercent ?? 0,
    haul_fee_eur: row.haulFeeEur ?? 0,
    shipping_eur: row.shippingEur ?? 0,
    total_eur: row.totalEur ?? 0,
    crypto_currency: row.cryptoCurrency || "",
    crypto_address: row.cryptoAddress || "",
    crypto_txid: row.cryptoTxid || "",
    tracking_number: row.trackingNumber || "",
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function toShopOrder(row: OrderRow, itemRows: OrderItemRow[]): ShopOrder {
  return { ...baseOrder(row), items: itemRows.map(toShopOrderItem) };
}

export function toAdminShopOrder(row: OrderRow, itemRows: OrderItemRow[], userName: string): AdminShopOrder {
  return {
    ...baseOrder(row),
    user_name: userName,
    admin_notes: row.adminNotes || "",
    items: itemRows.map(toAdminShopOrderItem),
  };
}

// ---------------------------------------------------------------------------
// Warenkorb
// ---------------------------------------------------------------------------

export async function getCart(user: User): Promise<{ lines: CartLine[]; totals: OrderTotals }> {
  await ensureDb();
  const feeSettings = await getFeeSettings();
  const shopSettings = await getShopSettings();

  const rows = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      chosenSize: cartItems.chosenSize,
      colorVariant: cartItems.colorVariant,
      quantity: cartItems.quantity,
      title: products.title,
      brand: products.brand,
      localImage: products.localImage,
      priceCny: products.priceCny,
      active: products.active,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, user.id))
    .orderBy(desc(cartItems.id));

  const lines: CartLine[] = rows.map((r) => {
    const priced = priceLine(r.priceCny, r.quantity, user, feeSettings);
    return {
      id: r.id,
      product_id: r.productId,
      title: r.title,
      brand: r.brand || "—",
      local_image: r.localImage || "",
      chosen_size: r.chosenSize || "",
      color_variant: r.colorVariant || "",
      quantity: priced.quantity,
      price_cny: priced.price_cny,
      base_price_eur: priced.base_price_eur,
      item_fee_eur: priced.item_fee_eur,
      final_unit_eur: priced.final_unit_eur,
      line_total_cny: priced.line_total_cny,
      line_total_eur: priced.line_total_eur,
    };
  });

  const totals = computeOrderTotals(lines, user, feeSettings, shopSettings.shipping_eur);
  return { lines, totals };
}

export async function addToCart(user: User, productId: number, chosenSize: string, colorVariant: string, quantity: number) {
  await ensureDb();
  const product = (await db.select().from(products).where(eq(products.id, productId)))[0];
  if (!product || product.active !== 1) throw new PublicError("Product not found", 404);

  const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
  const size = String(chosenSize || "").slice(0, 60);
  const color = String(colorVariant || "").slice(0, 120);

  const existing = (
    await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.userId, user.id),
          eq(cartItems.productId, productId),
          eq(cartItems.chosenSize, size)
        )
      )
  )[0];

  if (existing) {
    const updated = (
      await db
        .update(cartItems)
        .set({ quantity: Math.min(99, existing.quantity + qty) })
        .where(eq(cartItems.id, existing.id))
        .returning()
    )[0];
    return updated;
  }

  const inserted = (
    await db
      .insert(cartItems)
      .values({ userId: user.id, productId, chosenSize: size, colorVariant: color, quantity: qty })
      .returning()
  )[0];
  return inserted;
}

// ---------------------------------------------------------------------------
// Checkout: Warenkorb -> Order + OrderItems (Snapshot), Warenkorb leeren.
// Laueft in einer Transaktion: alles oder nichts.
// ---------------------------------------------------------------------------

export interface CheckoutInput {
  ship_name: string;
  ship_street: string;
  ship_zip: string;
  ship_city: string;
  ship_country: string;
  crypto_currency: "BTC" | "ETH" | "USDT";
}

export async function checkout(user: User, input: CheckoutInput) {
  await ensureDb();
  const feeSettings = await getFeeSettings();
  const shopSettings = await getShopSettings();

  const walletFor = (cur: string) =>
    cur === "BTC"
      ? shopSettings.crypto_btc_address
      : cur === "ETH"
        ? shopSettings.crypto_eth_address
        : shopSettings.crypto_usdt_address;

  const cryptoAddress = walletFor(input.crypto_currency);
  if (!cryptoAddress) {
    throw new PublicError(`Payment method ${input.crypto_currency} is currently unavailable.`, 400);
  }

  for (const [field, value] of Object.entries({
    ship_name: input.ship_name,
    ship_street: input.ship_street,
    ship_zip: input.ship_zip,
    ship_city: input.ship_city,
    ship_country: input.ship_country,
  })) {
    if (!value || !String(value).trim()) {
      throw new PublicError(`Shipping field ${field} is required.`, 400);
    }
  }

  // Warenkorb inkl. Produktdaten laden
  const rows = await db
    .select({
      cartId: cartItems.id,
      productId: cartItems.productId,
      chosenSize: cartItems.chosenSize,
      colorVariant: cartItems.colorVariant,
      quantity: cartItems.quantity,
      title: products.title,
      priceCny: products.priceCny,
      localImage: products.localImage,
      seller: products.seller,
      sourceUrl: products.sourceUrl,
      weidianUrl: products.weidianUrl,
      active: products.active,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, user.id));

  if (rows.length === 0) throw new PublicError("Your cart is empty.", 400);

  const pricedLines = rows.map((r) => ({
    raw: r,
    priced: priceLine(r.priceCny, r.quantity, user, feeSettings),
  }));
  const totals = computeOrderTotals(
    pricedLines.map((p) => p.priced),
    user,
    feeSettings,
    shopSettings.shipping_eur
  );

  const year = new Date().getFullYear();
  const ts = nowUtc();

  const orderRow = await db.transaction(async (tx) => {
    // 1) Order anlegen (order_number wird gleich danach final gesetzt)
    const inserted = (
      await tx
        .insert(orders)
        .values({
          orderNumber: `FS-${year}-PENDING`,
          userId: user.id,
          status: "awaiting_payment",
          shipName: String(input.ship_name).slice(0, 120),
          shipStreet: String(input.ship_street).slice(0, 200),
          shipZip: String(input.ship_zip).slice(0, 20),
          shipCity: String(input.ship_city).slice(0, 120),
          shipCountry: String(input.ship_country).slice(0, 120),
          subtotalCny: totals.subtotal_cny,
          subtotalEur: totals.subtotal_eur,
          itemFeesEur: totals.item_fees_eur,
          haulFeePercent: totals.haul_fee_percent,
          haulFeeEur: totals.haul_fee_eur,
          shippingEur: totals.shipping_eur,
          totalEur: totals.total_eur,
          cryptoCurrency: input.crypto_currency,
          cryptoAddress,
          createdAt: ts,
          updatedAt: ts,
        })
        .returning()
    )[0];

    const orderNumber = `FS-${year}-${String(inserted.id).padStart(4, "0")}`;
    const finalOrder = (
      await tx
        .update(orders)
        .set({ orderNumber })
        .where(eq(orders.id, inserted.id))
        .returning()
    )[0];

    // 2) Positionen als Snapshot einfrieren (Seller-Daten nur fuer Admin)
    for (const { raw, priced } of pricedLines) {
      await tx.insert(orderItems).values({
        orderId: inserted.id,
        productId: raw.productId,
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
        sourceUrl: raw.sourceUrl || "",
        weidianUrl: raw.weidianUrl || "",
        fulfillmentStatus: "pending",
        createdAt: ts,
      });
    }

    // 3) Warenkorb leeren
    await tx.delete(cartItems).where(eq(cartItems.userId, user.id));

    return finalOrder;
  });

  const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, orderRow.id));
  return toShopOrder(orderRow, itemRows);
}

// ---------------------------------------------------------------------------
// Orders lesen
// ---------------------------------------------------------------------------

export async function getOrderRow(orderId: number): Promise<OrderRow> {
  await ensureDb();
  const row = (await db.select().from(orders).where(eq(orders.id, orderId)))[0];
  if (!row) throw new PublicError("Order not found", 404);
  return row;
}

export async function getOrderItemsRows(orderId: number): Promise<OrderItemRow[]> {
  await ensureDb();
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function listOrdersForUser(user: User): Promise<ShopOrder[]> {
  await ensureDb();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.id));
  const result: ShopOrder[] = [];
  for (const row of rows) {
    const items = await getOrderItemsRows(row.id);
    result.push(toShopOrder(row, items));
  }
  return result;
}

export async function listAllOrdersAdmin(): Promise<AdminShopOrder[]> {
  await ensureDb();
  const rows = await db
    .select({
      order: orders,
      userName: users.name,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.id));
  const result: AdminShopOrder[] = [];
  for (const { order, userName } of rows) {
    const items = await getOrderItemsRows(order.id);
    result.push(toAdminShopOrder(order, items, userName));
  }
  return result;
}
