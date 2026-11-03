import { db, ensureDb, settings } from "./db";
import { Item, User, HaulSummary, FeeSettings, OrderTotals, ShopSettings } from "@/lib/types";

export async function getFeeSettings(): Promise<FeeSettings> {
  await ensureDb();
  const rows = await db.select().from(settings);
  const dict: Record<string, number> = {};
  for (const r of rows) {
    dict[r.key] = parseFloat(r.value) || 0;
  }

  const cnyToEur = dict["cny_to_eur"] ?? 0.13;
  return {
    cny_to_eur: cnyToEur,
    eur_to_cny: parseFloat((1 / (cnyToEur || 0.13)).toFixed(2)),
    default_item_fixed_eur: dict["default_item_fixed_eur"] ?? 0.0,
    default_item_percent: dict["default_item_percent"] ?? 0.0,
    default_haul_percent: dict["default_haul_percent"] ?? 0.0,
  };
}

export function enrichItem(
  item: any,
  memberUser: User | null,
  feeSettings: FeeSettings
): Item {
  const cny = item.price_cny !== null && item.price_cny !== undefined ? Number(item.price_cny) : null;
  const qty = Number(item.quantity || 1);
  const baseEur = cny !== null ? parseFloat((cny * feeSettings.cny_to_eur).toFixed(2)) : null;

  // Fee resolution: Item Override -> Member Override -> Global Default
  let effFixed = feeSettings.default_item_fixed_eur;
  if (memberUser && memberUser.custom_item_fixed_eur !== null && memberUser.custom_item_fixed_eur !== undefined) {
    effFixed = memberUser.custom_item_fixed_eur;
  }
  if (item.custom_fee_fixed_eur !== null && item.custom_fee_fixed_eur !== undefined) {
    effFixed = item.custom_fee_fixed_eur;
  }

  let effPct = feeSettings.default_item_percent;
  if (memberUser && memberUser.custom_item_percent !== null && memberUser.custom_item_percent !== undefined) {
    effPct = memberUser.custom_item_percent;
  }
  if (item.custom_fee_percent !== null && item.custom_fee_percent !== undefined) {
    effPct = item.custom_fee_percent;
  }

  let itemFeeEur = 0;
  let finalUnitEur = baseEur ?? 0;
  if (baseEur !== null) {
    const pctFee = parseFloat((baseEur * (effPct / 100)).toFixed(2));
    itemFeeEur = parseFloat((effFixed + pctFee).toFixed(2));
    finalUnitEur = parseFloat((baseEur + itemFeeEur).toFixed(2));
  }

  const lineTotalCny = cny !== null ? parseFloat((cny * qty).toFixed(2)) : null;
  const lineTotalEur = parseFloat((finalUnitEur * qty).toFixed(2));

  return {
    ...item,
    price_cny: cny,
    quantity: qty,
    base_price_eur: baseEur,
    effective_fee_fixed_eur: effFixed,
    effective_fee_percent: effPct,
    item_fee_eur: itemFeeEur,
    final_unit_eur: finalUnitEur,
    line_total_cny: lineTotalCny,
    line_total_eur: lineTotalEur,
  };
}

export function computeHaulSummary(
  items: Item[],
  memberUser: User | null,
  feeSettings: FeeSettings
): HaulSummary {
  let baseEurSum = 0;
  let baseCnySum = 0;
  let itemFeesSum = 0;
  let subtotalEur = 0;

  for (const it of items) {
    const qty = it.quantity || 1;
    if (it.base_price_eur !== null && it.base_price_eur !== undefined) {
      baseEurSum += it.base_price_eur * qty;
    }
    if (it.price_cny !== null && it.price_cny !== undefined) {
      baseCnySum += it.price_cny * qty;
    }
    if (it.item_fee_eur !== null && it.item_fee_eur !== undefined) {
      itemFeesSum += it.item_fee_eur * qty;
    }
    if (it.line_total_eur !== null && it.line_total_eur !== undefined) {
      subtotalEur += it.line_total_eur;
    }
  }

  let haulPct = feeSettings.default_haul_percent;
  if (memberUser && memberUser.custom_haul_percent !== null && memberUser.custom_haul_percent !== undefined) {
    haulPct = memberUser.custom_haul_percent;
  }

  const haulFeeEur = parseFloat((subtotalEur * (haulPct / 100)).toFixed(2));
  const finalTotalEur = parseFloat((subtotalEur + haulFeeEur).toFixed(2));
  const totalAdminProfit = parseFloat((itemFeesSum + haulFeeEur).toFixed(2));

  return {
    user_id: memberUser ? memberUser.id : 0,
    user_name: memberUser ? memberUser.name : "Unknown",
    items_count: items.length,
    base_eur_sum: parseFloat(baseEurSum.toFixed(2)),
    base_cny_sum: parseFloat(baseCnySum.toFixed(2)),
    item_fees_sum: parseFloat(itemFeesSum.toFixed(2)),
    subtotal_eur: parseFloat(subtotalEur.toFixed(2)),
    haul_fee_percent: haulPct,
    haul_fee_eur: haulFeeEur,
    final_total_eur: finalTotalEur,
    total_admin_profit_eur: totalAdminProfit,
    custom_item_fixed_eur: memberUser?.custom_item_fixed_eur ?? null,
    custom_item_percent: memberUser?.custom_item_percent ?? null,
    custom_haul_percent: memberUser?.custom_haul_percent ?? null,
  };
}

// ---------------------------------------------------------------------------
// Shop-System: Bestell-Totals + Shop-Settings (Crypto-Wallets, Versand)
// ---------------------------------------------------------------------------

export async function getShopSettings(): Promise<ShopSettings> {
  await ensureDb();
  const rows = await db.select().from(settings);
  const dict: Record<string, string> = {};
  for (const r of rows) {
    dict[r.key] = r.value;
  }
  return {
    cny_to_eur: parseFloat(dict["cny_to_eur"] || "") || 0.13,
    shipping_eur: parseFloat(dict["shipping_eur"] || "") || 0,
    crypto_btc_address: dict["crypto_btc_address"] || "",
    crypto_eth_address: dict["crypto_eth_address"] || "",
    crypto_usdt_address: dict["crypto_usdt_address"] || "",
  };
}

// Eine Warenkorb-/Bestellposition mit Preisen anreichern.
// Gleiche Fee-Resolution wie enrichItem: Item-Override -> Member-Override -> Global.
// Im Shop gibt es keine Item-Overrides, also Member -> Global.
export function priceLine(
  priceCny: number | null,
  quantity: number,
  memberUser: User | null,
  feeSettings: FeeSettings
) {
  const cny = priceCny !== null && priceCny !== undefined ? Number(priceCny) : null;
  const qty = Math.max(1, Number(quantity || 1));
  const baseEur = cny !== null ? parseFloat((cny * feeSettings.cny_to_eur).toFixed(2)) : null;

  let effFixed = feeSettings.default_item_fixed_eur;
  if (memberUser && memberUser.custom_item_fixed_eur !== null && memberUser.custom_item_fixed_eur !== undefined) {
    effFixed = memberUser.custom_item_fixed_eur;
  }
  let effPct = feeSettings.default_item_percent;
  if (memberUser && memberUser.custom_item_percent !== null && memberUser.custom_item_percent !== undefined) {
    effPct = memberUser.custom_item_percent;
  }

  let itemFeeEur = 0;
  let finalUnitEur = baseEur ?? 0;
  if (baseEur !== null) {
    const pctFee = parseFloat((baseEur * (effPct / 100)).toFixed(2));
    itemFeeEur = parseFloat((effFixed + pctFee).toFixed(2));
    finalUnitEur = parseFloat((baseEur + itemFeeEur).toFixed(2));
  }

  return {
    price_cny: cny,
    quantity: qty,
    base_price_eur: baseEur,
    item_fee_eur: itemFeeEur,
    final_unit_eur: finalUnitEur,
    line_total_cny: cny !== null ? parseFloat((cny * qty).toFixed(2)) : null,
    line_total_eur: parseFloat((finalUnitEur * qty).toFixed(2)),
  };
}

// Totals fuer einen Warenkorb / Checkout berechnen (Server-seitig, einzige
// Wahrheit). Liefert Subtotal (CNY + EUR), Item-Fees, Haul-Fee, Versand, Total.
export function computeOrderTotals(
  lines: { price_cny: number | null; quantity: number; base_price_eur: number | null; item_fee_eur: number; line_total_eur: number }[],
  memberUser: User | null,
  feeSettings: FeeSettings,
  shippingEur = 0
): OrderTotals {
  let subtotalCny = 0;
  let baseEurSum = 0;
  let itemFeesSum = 0;
  let subtotalEur = 0;

  for (const line of lines) {
    const qty = Math.max(1, line.quantity || 1);
    if (line.price_cny !== null && line.price_cny !== undefined) {
      subtotalCny += line.price_cny * qty;
    }
    if (line.base_price_eur !== null && line.base_price_eur !== undefined) {
      baseEurSum += line.base_price_eur * qty;
    }
    itemFeesSum += (line.item_fee_eur || 0) * qty;
    subtotalEur += line.line_total_eur || 0;
  }

  let haulPct = feeSettings.default_haul_percent;
  if (memberUser && memberUser.custom_haul_percent !== null && memberUser.custom_haul_percent !== undefined) {
    haulPct = memberUser.custom_haul_percent;
  }

  const subtotal = parseFloat(subtotalEur.toFixed(2));
  const haulFeeEur = parseFloat((subtotal * (haulPct / 100)).toFixed(2));
  const ship = parseFloat((shippingEur || 0).toFixed(2));
  const totalEur = parseFloat((subtotal + haulFeeEur + ship).toFixed(2));

  return {
    items_count: lines.length,
    subtotal_cny: parseFloat(subtotalCny.toFixed(2)),
    base_eur_sum: parseFloat(baseEurSum.toFixed(2)),
    item_fees_eur: parseFloat(itemFeesSum.toFixed(2)),
    subtotal_eur: subtotal,
    haul_fee_percent: haulPct,
    haul_fee_eur: haulFeeEur,
    shipping_eur: ship,
    total_eur: totalEur,
  };
}
