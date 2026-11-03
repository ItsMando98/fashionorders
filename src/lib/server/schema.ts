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
