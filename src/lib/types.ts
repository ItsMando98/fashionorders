export interface User {
  id: number;
  name: string;
  role: "admin" | "friend";
  share_all_friends: number;
  avatar_initials: string;
  custom_item_fixed_eur?: number | null;
  custom_item_percent?: number | null;
  custom_haul_percent?: number | null;
  disabled?: number;
  must_setup?: number;
}

export interface FriendDirectoryEntry {
  id: number;
  name: string;
  avatar_initials: string;
  role: string;
  custom_item_fixed_eur?: number | null;
  custom_item_percent?: number | null;
  custom_haul_percent?: number | null;
}

export interface OrderItem {
  id: number;
  user_id: number;
  user_name: string;
  user_initials: string;
  url: string;
  album_url?: string;
  weidian_url: string;
  source_platform: string;
  seller: string;
  title: string;
  brand: string;
  category: string;
  available_sizes: string;
  chosen_size: string;
  color_variant: string;
  quantity: number;
  price_cny: number | null;
  price_eur: number | null;
  base_price_cny?: number | null;
  base_price_eur?: number | null;
  fee_unit_eur?: number | null;
  item_fee_eur?: number | null;
  final_unit_eur?: number | null;
  line_base_cny?: number | null;
  line_base_eur?: number | null;
  line_fee_eur?: number | null;
  line_total_cny: number | null;
  line_total_eur: number | null;
  effective_fee_fixed_eur?: number;
  effective_fee_percent?: number;
  custom_fee_fixed_eur?: number | null;
  custom_fee_percent?: number | null;
  has_item_fee_override?: boolean;
  shipping_cny: number;
  stage: "cart" | "submitted";
  order_status: string;
  is_shared: number;
  description: string;
  user_notes: string;
  admin_notes: string;
  tracking_number: string;
  local_image: string;
  created_at: string;
  updated_at: string;
}

export interface ScrapedDraft {
  url: string;
  album_url?: string;
  weidian_url: string;
  source_platform: string;
  seller: string;
  status_code: number;
  title: string;
  brand: string;
  category: string;
  available_sizes: string;
  price_cny: number | null;
  price_eur: number | null;
  description: string;
  local_image: string;
  order_status: string;
}

export interface HaulSummary {
  user_id: number;
  user_name: string;
  items_count: number;
  base_eur_sum: number;
  base_cny_sum: number;
  item_fees_sum: number;
  subtotal_eur: number;
  haul_fee_percent: number;
  haul_fee_eur: number;
  final_total_eur: number;
  total_admin_profit_eur: number;
  custom_item_fixed_eur?: number | null;
  custom_item_percent?: number | null;
  custom_haul_percent?: number | null;
}

export interface WorkspaceResponse {
  current_user: User;
  settings: {
    cny_to_eur: number;
    eur_to_cny: number;
    default_item_fixed_eur: number;
    default_item_percent: number;
    default_haul_percent: number;
  };
  my_items: OrderItem[];
  my_haul_summary?: HaulSummary;
  shared_items: OrderItem[];
  friends_directory: FriendDirectoryEntry[];
  my_share_targets: number[];
  admin_all_items?: OrderItem[];
  admin_users?: User[];
  admin_haul_summaries?: HaulSummary[];
}

export type Item = OrderItem;
export type FeeSettings = WorkspaceResponse["settings"];

// ---------------------------------------------------------------------------
// Shop-System
// ---------------------------------------------------------------------------

// Kunden-Sicht auf ein Produkt: KEINE Seller-/Source-Felder.
export interface PublicProduct {
  id: number;
  title: string;
  brand: string;
  category: string;
  available_sizes: string;
  description: string;
  price_cny: number | null;
  price_eur: number | null; // umgerechnet, inkl. Item-Fee (final_unit_eur)
  image_url: string;
  local_image: string;
  source_platform: string;
  active: number;
  created_at: string;
}

// Admin-Sicht: zusaetzlich Seller + Quell-URLs.
export interface AdminProduct extends PublicProduct {
  seller: string;
  source_url: string;
  weidian_url: string;
}

export interface CartLine {
  id: number; // cart_items.id
  product_id: number;
  title: string;
  brand: string;
  local_image: string;
  chosen_size: string;
  color_variant: string;
  quantity: number;
  price_cny: number | null;
  base_price_eur: number | null;
  item_fee_eur: number;
  final_unit_eur: number;
  line_total_cny: number | null;
  line_total_eur: number;
}

export interface OrderTotals {
  items_count: number;
  subtotal_cny: number;
  base_eur_sum: number;
  item_fees_eur: number;
  subtotal_eur: number;
  haul_fee_percent: number;
  haul_fee_eur: number;
  shipping_eur: number;
  total_eur: number;
}

export type ShopOrderStatus =
  | "awaiting_payment"
  | "paid"
  | "ordering"
  | "shipped"
  | "delivered"
  | "cancelled";

// Kunden-Sicht auf eine Bestellposition: KEINE Seller-/Source-Felder.
export interface ShopOrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  title: string;
  chosen_size: string;
  color_variant: string;
  quantity: number;
  price_cny: number | null;
  base_eur: number | null;
  fee_eur: number;
  line_total_eur: number;
  local_image: string;
  fulfillment_status: string;
  tracking_number: string;
}

export interface ShopOrder {
  id: number;
  order_number: string;
  user_id: number;
  status: ShopOrderStatus;
  ship_name: string;
  ship_street: string;
  ship_zip: string;
  ship_city: string;
  ship_country: string;
  subtotal_cny: number;
  subtotal_eur: number;
  item_fees_eur: number;
  haul_fee_percent: number;
  haul_fee_eur: number;
  shipping_eur: number;
  total_eur: number;
  crypto_currency: string;
  crypto_address: string;
  crypto_txid: string;
  tracking_number: string;
  created_at: string;
  updated_at: string;
  items?: ShopOrderItem[];
}

// Admin-Sicht: Order + Kundendaten + Seller-Felder in den Positionen.
export interface AdminShopOrderItem extends ShopOrderItem {
  seller: string;
  source_url: string;
  weidian_url: string;
}

export interface AdminShopOrder extends ShopOrder {
  user_name: string;
  admin_notes: string;
  items?: AdminShopOrderItem[];
}

export interface ShopSettings {
  cny_to_eur: number;
  shipping_eur: number;
  crypto_btc_address: string;
  crypto_eth_address: string;
  crypto_usdt_address: string;
}

// Auto-Scraper: konfigurierte Seller-Quelle inkl. Status des letzten Laufs.
export interface ScrapeSource {
  id: number;
  seller_url: string;
  label: string;
  interval_hours: number;
  per_run_limit: number;
  active: number;
  last_run_at: string | null;
  last_status: string; // "" | "running" | "ok" | "error"
  last_message: string;
  last_added: number;
  created_at: string;
}

