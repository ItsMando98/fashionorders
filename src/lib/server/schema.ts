import { pgTable, text, integer, serial, doublePrecision } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Timestamps bleiben TEXT im selben Format wie bisher unter SQLite
// ("YYYY-MM-DD HH:MM:SS", UTC), damit sich kein Verhalten aendert.
const nowUtc = sql`to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')`;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("friend"),
  avatarInitials: text("avatar_initials").notNull().default("??"),
  shareAllFriends: integer("share_all_friends").notNull().default(0),
  customItemFixedEur: doublePrecision("custom_item_fixed_eur"),
  customItemPercent: doublePrecision("custom_item_percent"),
  customHaulPercent: doublePrecision("custom_haul_percent"),
  disabled: integer("disabled").notNull().default(0),
  mustSetup: integer("must_setup").notNull().default(0),
  email: text("email").unique(),
  bio: text("bio").notNull().default(""),
  handle: text("handle"),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(nowUtc),
  expiresAt: text("expires_at"),
  setupOnly: integer("setup_only").notNull().default(0),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  weidianUrl: text("weidian_url").default(""),
  sourcePlatform: text("source_platform").default("Yupoo"),
  seller: text("seller").default(""),
  title: text("title").notNull(),
  brand: text("brand").default("—"),
  category: text("category").default("Apparel / Item"),
  availableSizes: text("available_sizes").default(""),
  chosenSize: text("chosen_size").default(""),
  colorVariant: text("color_variant").default(""),
  quantity: integer("quantity").notNull().default(1),
  priceCny: doublePrecision("price_cny"),
  shippingCny: doublePrecision("shipping_cny").default(0),
  stage: text("stage").notNull().default("submitted"),
  orderStatus: text("order_status").notNull().default("Pending"),
  description: text("description").default(""),
  userNotes: text("user_notes").default(""),
  adminNotes: text("admin_notes").default(""),
  trackingNumber: text("tracking_number").default(""),
  imageUrl: text("image_url").default(""),
  localImage: text("local_image").default(""),
  createdAt: text("created_at").notNull().default(nowUtc),
  updatedAt: text("updated_at").notNull().default(nowUtc),
  isShared: integer("is_shared").notNull().default(0),
  customFeeFixedEur: doublePrecision("custom_fee_fixed_eur"),
  customFeePercent: doublePrecision("custom_fee_percent"),
});

// ---------------------------------------------------------------------------
// Shop-System: globaler Produktkatalog + Warenkorb + echte Orders
// Seller/source_url/weidian_url sind ADMIN-ONLY und duerfen nie in
// Kunden-Responses ausgeliefert werden.
// ---------------------------------------------------------------------------

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  brand: text("brand").default("—"),
  category: text("category").default("Apparel / Item"),
  availableSizes: text("available_sizes").default(""),
  description: text("description").default(""),
  priceCny: doublePrecision("price_cny"),
  imageUrl: text("image_url").default(""),
  localImage: text("local_image").default(""),
  sourcePlatform: text("source_platform").default("Yupoo"),
  seller: text("seller").default(""),
  sourceUrl: text("source_url").notNull().default(""),
  weidianUrl: text("weidian_url").default(""),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(nowUtc),
  updatedAt: text("updated_at").notNull().default(nowUtc),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  chosenSize: text("chosen_size").default(""),
  colorVariant: text("color_variant").default(""),
  quantity: integer("quantity").notNull().default(1),
  createdAt: text("created_at").notNull().default(nowUtc),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // awaiting_payment -> paid -> ordering -> shipped -> delivered (+ cancelled)
  status: text("status").notNull().default("awaiting_payment"),
  shipName: text("ship_name").default(""),
  shipStreet: text("ship_street").default(""),
  shipZip: text("ship_zip").default(""),
  shipCity: text("ship_city").default(""),
  shipCountry: text("ship_country").default(""),
  subtotalCny: doublePrecision("subtotal_cny").notNull().default(0),
  subtotalEur: doublePrecision("subtotal_eur").notNull().default(0),
  itemFeesEur: doublePrecision("item_fees_eur").notNull().default(0),
  haulFeePercent: doublePrecision("haul_fee_percent").notNull().default(0),
  haulFeeEur: doublePrecision("haul_fee_eur").notNull().default(0),
  shippingEur: doublePrecision("shipping_eur").notNull().default(0),
  totalEur: doublePrecision("total_eur").notNull().default(0),
  cryptoCurrency: text("crypto_currency").default(""),
  cryptoAddress: text("crypto_address").default(""),
  cryptoTxid: text("crypto_txid").default(""),
  adminNotes: text("admin_notes").default(""),
  trackingNumber: text("tracking_number").default(""),
  createdAt: text("created_at").notNull().default(nowUtc),
  updatedAt: text("updated_at").notNull().default(nowUtc),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  // Snapshot: Werte zum Kaufzeitpunkt eingefroren
  title: text("title").notNull(),
  chosenSize: text("chosen_size").default(""),
  colorVariant: text("color_variant").default(""),
  quantity: integer("quantity").notNull().default(1),
  priceCny: doublePrecision("price_cny"),
  baseEur: doublePrecision("base_eur"),
  feeEur: doublePrecision("fee_eur").notNull().default(0),
  lineTotalEur: doublePrecision("line_total_eur").notNull().default(0),
  localImage: text("local_image").default(""),
  seller: text("seller").default(""),
  sourceUrl: text("source_url").default(""),
  weidianUrl: text("weidian_url").default(""),
  fulfillmentStatus: text("fulfillment_status").notNull().default("pending"),
  trackingNumber: text("tracking_number").default(""),
  createdAt: text("created_at").notNull().default(nowUtc),
});

// Auto-Scraper: konfigurierte Yupoo-Seller, die der Scheduler regelmaessig
// in den Produktkatalog scraped (Dedupe laeuft ueber products.source_url).
export const scrapeSources = pgTable("scrape_sources", {
  id: serial("id").primaryKey(),
  sellerUrl: text("seller_url").notNull(),
  label: text("label").default(""),
  intervalHours: integer("interval_hours").notNull().default(24),
  perRunLimit: integer("per_run_limit").notNull().default(20),
  active: integer("active").notNull().default(1),
  lastRunAt: text("last_run_at"),
  lastStatus: text("last_status").notNull().default(""),
  lastMessage: text("last_message").default(""),
  lastAdded: integer("last_added").notNull().default(0),
  createdAt: text("created_at").notNull().default(nowUtc),
  updatedAt: text("updated_at").notNull().default(nowUtc),
});

export const orderShares = pgTable("order_shares", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sharedWithUserId: integer("shared_with_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(nowUtc),
});

export type UserRow = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ItemRow = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type OrderShareRow = typeof orderShares.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type CartItemRow = typeof cartItems.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type ScrapeSourceRow = typeof scrapeSources.$inferSelect;
export type InsertScrapeSource = typeof scrapeSources.$inferInsert;

export const loginCodes = pgTable("login_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: text("purpose").notNull(),
  name: text("name"),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull().default(nowUtc),
});
