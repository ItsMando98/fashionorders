import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("friend"),
  avatarInitials: text("avatar_initials").notNull().default("??"),
  shareAllFriends: integer("share_all_friends").notNull().default(0),
  customItemFixedEur: real("custom_item_fixed_eur"),
  customItemPercent: real("custom_item_percent"),
  customHaulPercent: real("custom_haul_percent"),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  priceCny: real("price_cny"),
  shippingCny: real("shipping_cny").default(0),
  stage: text("stage").notNull().default("submitted"),
  orderStatus: text("order_status").notNull().default("Pending"),
  description: text("description").default(""),
  userNotes: text("user_notes").default(""),
  adminNotes: text("admin_notes").default(""),
  trackingNumber: text("tracking_number").default(""),
  imageUrl: text("image_url").default(""),
  localImage: text("local_image").default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  isShared: integer("is_shared").notNull().default(1),
  customFeeFixedEur: real("custom_fee_fixed_eur"),
  customFeePercent: real("custom_fee_percent"),
});

export const orderShares = sqliteTable("order_shares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sharedWithUserId: integer("shared_with_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type UserRow = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ItemRow = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type OrderShareRow = typeof orderShares.$inferSelect;
