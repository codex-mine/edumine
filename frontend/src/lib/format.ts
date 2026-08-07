/** Display formatting shared by the dashboard cards. */

const CURRENCY_SYMBOL = "৳";

/** Missing or non-numeric input reads as 0 rather than leaking "undefined"/"NaN"
 * into the UI — every numeric formatter below funnels through this. */
function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumber(value: number | string | null | undefined, fractionDigits = 0): string {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatCurrency(value: number | string | null | undefined, fractionDigits = 0): string {
  return `${CURRENCY_SYMBOL} ${formatNumber(value, fractionDigits)}`;
}

/** Short form for chart centres and stat tiles: ৳ 1.88M / ৳ 12.4K. */
export function formatCompactCurrency(value: number | string | null | undefined): string {
  const amount = toNumber(value);
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${CURRENCY_SYMBOL} ${formatNumber(amount / 1_000_000, 2)}M`;
  if (abs >= 1_000) return `${CURRENCY_SYMBOL} ${formatNumber(amount / 1_000, 1)}K`;
  return formatCurrency(amount);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  return `${formatNumber(value, fractionDigits)}%`;
}

/** "2 min ago" / "3 hr ago" / "May 18" — the age readout used by activity feeds. */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";

  const seconds = Math.round((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "17 May, 1990" — the long form the profile cards read dates in. */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** "January 1, 2024 (2.5 years ago)" — the tenure line under a profile name.
 * Months carry one decimal of a year until the first anniversary, after which
 * whole-and-half years read more naturally than a month count. */
export function formatDateWithTenure(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(parsed.getTime())) return null;

  const date = formatLongDate(iso);
  const months = Math.max(0, Math.round((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  if (months < 1) return `${date} (this month)`;
  if (months < 12) return `${date} (${months} ${months === 1 ? "month" : "months"} ago)`;

  const years = Math.round((months / 12) * 10) / 10;
  return `${date} (${formatNumber(years, Number.isInteger(years) ? 0 : 1)} years ago)`;
}

export function formatDayNumber(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "--" : String(parsed.getDate()).padStart(2, "0");
}

export function formatMonthShort(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(undefined, { month: "short" });
}

/** Turns a signed percentage change into the StatCard `delta` shape. */
export function deltaFrom(
  change: number | null | undefined
): { value: string; direction: "up" | "down" } | undefined {
  if (change === null || change === undefined) return undefined;
  return {
    value: `${formatNumber(Math.abs(change), 1)}%`,
    direction: change >= 0 ? "up" : "down",
  };
}

export function initialsOf(name: string | null | undefined): string {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
