/** Customer-facing commerce contracts. Procurement fields never belong in these DTOs. */
export interface ProductVariant {
  id: number;
  size: string;
  color: string;
  sku: string;
  availability: "review" | "available" | "unavailable";
  price_approved: boolean;
  price_cents: number | null;
  price_fen: number | null;
}
export interface ProductMedia {
  id: number;
  variant_id: number | null;
  alt: string;
  position: number;
  kind: string;
  url: string;
}
export interface CommerceProduct {
  id: number;
  title: string;
  brand: string;
  description: string;
  gender: string;
  category_ids: string[];
  material: string;
  fit: string;
  visibility: "catalog" | "private";
  publication: "draft" | "review" | "published" | "archived";
  active: number;
  variants: ProductVariant[];
  media: ProductMedia[];
  saved: boolean;
  notes: string;
  created_at: string;
  import_url?: string;
}
export interface OfferLine {
  item_id: number;
  title: string;
  size: string;
  color: string;
  sku: string;
  quantity: number;
  unit_cents: number;
}
export interface CommerceOffer {
  id: number;
  version: number;
  lines: OfferLine[];
  shipping_cents: number;
  total_cents: number;
  total_fen: number;
  cny_to_eur: string;
  delivery_note: string;
  expires_at: string;
  accepted_at: string | null;
}
export interface PaymentRequest {
  id: number;
  // ETH/USDT occur only in historical, inactive snapshots.
  currency: "BTC" | "USDC" | "ETH" | "USDT";
  network: "bitcoin" | "ethereum";
  address: string;
  token_contract: string;
  decimals: number;
  amount_atoms: string;
  rate_eur: string;
  total_cents: number;
  status: "pending" | "submitted" | "confirmed" | "exception" | "expired";
  txid: string | null;
  exception: string;
  expires_at: string;
}
export interface CommerceOrderItem {
  id: number;
  product_id: number | null;
  title: string;
  size: string;
  color: string;
  sku: string;
  quantity: number;
  notes: string;
  estimated_cents: number | null;
}
export interface CommerceOrder {
  id: number;
  number: string;
  status:
    | "review"
    | "offered"
    | "confirmed"
    | "procurement"
    | "completed"
    | "cancelled";
  payment_status:
    | "pending"
    | "review"
    | "confirmed"
    | "partially_refunded"
    | "refunded";
  address: {
    name: string;
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  accepted_offer_id: number | null;
  items: CommerceOrderItem[];
  offers: CommerceOffer[];
  payments: PaymentRequest[];
  created_at: string;
}
