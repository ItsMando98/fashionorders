import { USDC_ETHEREUM_CONTRACT } from "./payment-policy";
function formatAtoms(atoms: string, precision: number) {
  const s = BigInt(atoms)
    .toString()
    .padStart(precision + 1, "0");
  return precision ? `${s.slice(0, -precision)}.${s.slice(-precision)}` : s;
}
export function paymentUri(p: {
  currency: string;
  network: string;
  address: string;
  amount_atoms: string;
  decimals: number;
  token_contract?: string;
}): string {
  if (p.currency === "BTC" && p.network === "bitcoin")
    return `bitcoin:${p.address}?amount=${formatAtoms(p.amount_atoms, p.decimals)}`;
  if (
    p.currency === "USDC" &&
    p.network === "ethereum" &&
    p.token_contract?.toLowerCase() === USDC_ETHEREUM_CONTRACT.toLowerCase()
  )
    return `ethereum:${p.token_contract}@1/transfer?address=${p.address}&uint256=${p.amount_atoms}`;
  return "";
}
