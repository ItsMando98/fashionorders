// Client-sichere Format-Helfer fuer die Storefront.

export function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `€${value.toFixed(2)}`;
}

export function formatCny(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `¥${value.toFixed(2)}`;
}

// local_image kann "/images/xyz.png" oder nur "xyz.png" sein.
export function imgSrc(localImage: string | null | undefined): string {
  if (!localImage) return "";
  if (localImage.startsWith("/")) return localImage;
  return `/images/${localImage}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  ordering: "Ordering from supplier",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  awaiting_payment: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ordering: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  shipped: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  delivered: "bg-emerald-600/20 text-emerald-300 border-emerald-600/40",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};
