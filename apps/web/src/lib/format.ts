const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1.25 Cr / ₹78.5 L / ₹45,000 – Indian short notation. */
export function formatINRShort(value: number): string {
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);
  if (v >= 1e7) return `${sign}₹${trim(v / 1e7)} Cr`;
  if (v >= 1e5) return `${sign}₹${trim(v / 1e5)} L`;
  return `${sign}₹${inr.format(Math.round(v))}`;
}

export function formatINR(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${inr.format(Math.round(Math.abs(value)))}`;
}

function trim(n: number) {
  return n >= 100 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(iso);
}

/** Indian digit grouping with up to `digits` decimals (trailing zeros trimmed). */
export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(value);
}

/** ₹ per man-day, e.g. "₹10,000 / MD". */
export function formatPerMd(value: number): string {
  return `${formatINR(value)} / MD`;
}
