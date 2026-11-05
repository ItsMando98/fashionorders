import { supportedCurrency, USDC_ETHEREUM_CONTRACT } from "./payment-policy";
import type { User } from "../types";
import { PublicError } from "../server/http";
import {
  database,
  transaction,
  ownOrder,
  event,
  requireAdmin,
  type Row,
} from "./core";
import { atomAmount, integer, decimal } from "./money";
export async function spotRate(currency: string): Promise<string> {
  if (!supportedCurrency(currency)) throw new PublicError("Ungültige Währung.");
  let response: Response;
  try {
    response = await fetch(
      `https://api.coinbase.com/v2/prices/${currency}-EUR/spot`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      },
    );
  } catch {
    throw new PublicError(
      "Kursquelle nicht erreichbar. Bitte später erneut versuchen.",
      503,
    );
  }
  if (!response.ok)
    throw new PublicError("Kein aktueller Kurs verfügbar.", 503);
  const data = await response.json();
  const rate = String(data?.data?.amount || "");
  if (
    data?.data?.currency !== "EUR" ||
    !/^\d+(\.\d{1,12})?$/.test(rate) ||
    decimal(rate, 12) <= BigInt(0)
  )
    throw new PublicError("Kursquelle lieferte keinen gültigen EUR-Kurs.", 503);
  return rate;
}
export async function createPayment(
  user: User,
  orderId: number,
  methodId: number,
  rateProvider = spotRate,
) {
  const tx = database();
  const o = await ownOrder(tx, user, orderId);
  if (o.user_id !== user.id)
    throw new PublicError("Nur der Kunde kann eine Zahlung anfordern.", 403);
  if (o.status !== "confirmed" || o.payment_status === "confirmed")
    throw new PublicError("Keine offene Zahlung für diese Bestellung.", 409);
  const [m] =
    await tx`SELECT * FROM shop_payment_methods WHERE id=${methodId} AND enabled=true`;
  if (!m || !supportedCurrency(m.currency))
    throw new PublicError("Zahlungsart nicht freigegeben.");
  // Reuse the active request without contacting the rate provider.
  const [active] =
    await tx`SELECT id FROM shop_payment_requests WHERE order_id=${orderId} AND status IN ('pending','submitted') AND expires_at>now() ORDER BY id DESC LIMIT 1`;
  if (active) return active.id as number;
  const rate = await rateProvider(m.currency);
  return transaction(async (sql) => {
    const order = await ownOrder(sql, user, orderId, true);
    if (
      order.status !== "confirmed" ||
      order.payment_status === "confirmed" ||
      !order.accepted_offer_id
    )
      throw new PublicError("Zuerst ein gültiges Angebot annehmen.", 409);
    const [old] =
      await sql`SELECT * FROM shop_payment_requests WHERE order_id=${orderId} AND status IN ('pending','submitted') AND expires_at>now() ORDER BY id DESC LIMIT 1`;
    if (old) return old.id as number;
    const [submitted] =
      await sql`SELECT id FROM shop_payment_requests WHERE order_id=${orderId} AND status IN ('submitted','exception') LIMIT 1`;
    if (submitted)
      throw new PublicError("Die vorhandene Zahlung wird zuerst geprüft.", 409);
    const [method] =
      await sql`SELECT * FROM shop_payment_methods WHERE id=${methodId} AND enabled=true FOR SHARE`;
    if (!method || method.address !== m.address || method.network !== m.network)
      throw new PublicError("Zahlungsart wurde geändert.", 409);
    const [offer] =
      await sql`SELECT total_cents FROM shop_offers WHERE id=${order.accepted_offer_id}`;
    await sql`UPDATE shop_payment_requests SET status='expired' WHERE order_id=${orderId} AND status='pending' AND expires_at<=now()`;
    const [p] =
      await sql`INSERT INTO shop_payment_requests(order_id,method_id,currency,network,address,token_contract,decimals,amount_atoms,rate_eur,total_cents,expires_at) VALUES(${orderId},${method.id},${method.currency},${method.network},${method.address},${method.token_contract},${method.decimals},${atomAmount(Number(offer.total_cents), rate, method.decimals)},${rate},${offer.total_cents},now()+interval '15 minutes') RETURNING id`;
    await event(sql, user, orderId, "payment_requested", { payment_id: p.id });
    return p.id as number;
  });
}
export async function submitTxid(
  user: User,
  orderId: number,
  id: number,
  txid: string,
) {
  return transaction(async (tx) => {
    const o = await ownOrder(tx, user, orderId, true);
    if (o.user_id !== user.id || o.status !== "confirmed")
      throw new PublicError("Zahlung kann nicht eingereicht werden.", 409);
    const [p] =
      await tx`SELECT * FROM shop_payment_requests WHERE id=${id} AND order_id=${orderId} FOR UPDATE`;
    if (!p) throw new PublicError("Zahlungsanforderung nicht gefunden.", 404);
    const clean = txid.trim().toLowerCase().replace(/^0x/, "");
    if (!/^[a-f0-9]{64}$/.test(clean))
      throw new PublicError("Ungültige Transaktions-ID.");
    if (p.txid === clean) return;
    if (p.txid || ["confirmed", "exception"].includes(p.status))
      throw new PublicError("Zahlung ist bereits in Prüfung.", 409);
    const late = new Date(p.expires_at) <= new Date();
    try {
      await tx`UPDATE shop_payment_requests SET txid=${clean},status=${late ? "exception" : "submitted"},exception=${late ? "late_payment" : ""} WHERE id=${id}`;
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new PublicError(
          "Diese Transaktion wurde bereits verwendet.",
          409,
        );
      throw e;
    }
    await tx`UPDATE shop_orders SET payment_status='review' WHERE id=${orderId}`;
    await event(tx, user, orderId, "payment_submitted", { payment_id: id });
  });
}
export async function confirmPayment(
  user: User,
  orderId: number,
  id: number,
  body: Row,
) {
  requireAdmin(user);
  return transaction(async (tx) => {
    const o = await ownOrder(tx, user, orderId, true);
    const [p] =
      await tx`SELECT * FROM shop_payment_requests WHERE id=${id} AND order_id=${orderId} FOR UPDATE`;
    if (
      !p ||
      !p.txid ||
      !["submitted", "exception"].includes(p.status) ||
      o.status !== "confirmed"
    )
      throw new PublicError("Keine prüfbare Zahlung.", 409);
    if (
      body.verified_network !== p.network ||
      String(body.verified_address) !== p.address
    )
      throw new PublicError("Netzwerk und Empfänger stimmen nicht überein.");
    const amount = String(body.actual_atoms || "");
    if (!/^\d+$/.test(amount))
      throw new PublicError(
        "Tatsächlichen Betrag in kleinster Einheit angeben.",
      );
    const actual = BigInt(amount),
      expected = BigInt(p.amount_atoms);
    const discrepancy =
      actual < expected
        ? "underpayment"
        : actual > expected
          ? "overpayment"
          : p.exception;
    if (discrepancy && !body.resolve_exception) {
      await tx`UPDATE shop_payment_requests SET actual_atoms=${amount},status='exception',exception=${discrepancy} WHERE id=${id}`;
      await event(tx, user, orderId, "payment_exception", {
        payment_id: id,
        reason: discrepancy,
      });
      return;
    }
    if (body.resolve_exception && !String(body.note || "").trim())
      throw new PublicError("Begründung der Ausnahmefreigabe erforderlich.");
    await tx`UPDATE shop_payment_requests SET actual_atoms=${amount},status='confirmed',exception=${discrepancy || ""} WHERE id=${id}`;
    await tx`UPDATE shop_orders SET payment_status='confirmed',updated_at=now() WHERE id=${orderId}`;
    await event(tx, user, orderId, "payment_confirmed", {
      payment_id: id,
      note: String(body.note || "").slice(0, 2000),
    });
  });
}
export async function refund(user: User, orderId: number, body: Row) {
  requireAdmin(user);
  return transaction(async (tx) => {
    const o = await ownOrder(tx, user, orderId, true);
    if (!["confirmed", "partially_refunded"].includes(o.payment_status))
      throw new PublicError("Keine erstattbare Zahlung.");
    if (!String(body.reference || "").trim() || !String(body.note || "").trim())
      throw new PublicError("Erstattungsreferenz und Begründung erforderlich.");
    const amount = integer(body.amount_cents, 1, 100000000);
    const [offer] =
      await tx`SELECT total_cents FROM shop_offers WHERE id=${o.accepted_offer_id}`;
    const [prev] =
      await tx`SELECT coalesce(sum((data->>'amount_cents')::bigint),0) AS refunded FROM shop_events WHERE order_id=${orderId} AND type='refunded'`;
    const total = Number(prev.refunded) + amount;
    if (total > Number(offer.total_cents))
      throw new PublicError("Erstattung übersteigt Bestellbetrag.");
    await tx`UPDATE shop_orders SET payment_status=${total === Number(offer.total_cents) ? "refunded" : "partially_refunded"} WHERE id=${orderId}`;
    await event(tx, user, orderId, "refunded", {
      amount_cents: amount,
      reference: String(body.reference).slice(0, 200),
      note: String(body.note).slice(0, 2000),
    });
  });
}
export { paymentUri } from "./payment-uri";
export async function saveMethod(user: User, b: Row) {
  requireAdmin(user);
  const currency = String(b.currency),
    network = String(b.network),
    address = String(b.address || "").trim();
  if (
    !(
      (currency === "BTC" && network === "bitcoin") ||
      (currency === "USDC" && network === "ethereum")
    )
  )
    throw new PublicError(
      "Unterstützt: BTC auf Bitcoin und USDC auf Ethereum/ERC-20.",
    );
  if (
    currency === "BTC"
      ? !/^(bc1|[13])[a-zA-Z0-9]{20,90}$/.test(address)
      : !/^0x[a-fA-F0-9]{40}$/.test(address)
  )
    throw new PublicError("Ungültige Wallet-Adresse.");
  const contract = currency === "USDC" ? USDC_ETHEREUM_CONTRACT : "";
  if (b.enabled === true) await spotRate(currency);
  await database()`INSERT INTO shop_payment_methods(currency,network,address,token_contract,decimals,enabled) VALUES(${currency},${network},${address},${contract},${currency === "BTC" ? 8 : 6},${b.enabled === true}) ON CONFLICT(currency,network) DO UPDATE SET address=excluded.address,token_contract=excluded.token_contract,decimals=excluded.decimals,enabled=excluded.enabled`;
}
