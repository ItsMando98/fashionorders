/** Enabled payment assets; legacy payment snapshots remain readable. */
export const PAYMENT_CURRENCIES = ["BTC", "USDC"] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];
// Ethereum mainnet native USDC. Verified against Circle's contract registry.
// https://developers.circle.com/stablecoins/usdc-contract-addresses.md
export const USDC_ETHEREUM_CONTRACT =
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export function supportedCurrency(
  currency: string,
): currency is PaymentCurrency {
  return (PAYMENT_CURRENCIES as readonly string[]).includes(currency);
}
