const SHOP_ROOTS = ["yupoo.com", "weidian.com"];
const IMAGE_ROOTS = ["yupoo.com", "weidian.com", "geilicdn.com"];

function hostMatches(hostname: string, roots: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return roots.some((root) => host === root || host.endsWith(`.${root}`));
}

export function isAllowedShopHost(hostname: string): boolean {
  return hostMatches(hostname, SHOP_ROOTS);
}

export function isAllowedImageHost(hostname: string): boolean {
  return hostMatches(hostname, IMAGE_ROOTS);
}

function ipv4ToInt(host: string): number | null {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return null;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function inCidr(ip: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

export function isPrivateAddress(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }

  const ipv4 = ipv4ToInt(host);
  if (ipv4 !== null) {
    return (
      inCidr(ipv4, ipv4ToInt("0.0.0.0")!, 8) ||
      inCidr(ipv4, ipv4ToInt("10.0.0.0")!, 8) ||
      inCidr(ipv4, ipv4ToInt("127.0.0.0")!, 8) ||
      inCidr(ipv4, ipv4ToInt("169.254.0.0")!, 16) ||
      inCidr(ipv4, ipv4ToInt("172.16.0.0")!, 12) ||
      inCidr(ipv4, ipv4ToInt("192.168.0.0")!, 16) ||
      inCidr(ipv4, ipv4ToInt("100.64.0.0")!, 10)
    );
  }

  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
  }

  return false;
}

export function isPrivateHostname(hostname: string): boolean {
  return isPrivateAddress(hostname);
}
