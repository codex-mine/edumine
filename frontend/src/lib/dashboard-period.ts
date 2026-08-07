/** The date-range filter shared by the dashboard header and every section card.
 *
 * Mirrors `app/modules/dashboard/periods.py` on the API side: the same keys go
 * out as `?period=`, and a custom range additionally sends `date_from`/`date_to`.
 */

export type PeriodKey =
  | "today"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "this_year"
  | "custom";

export interface DashboardPeriod {
  key: PeriodKey;
  /** ISO date (yyyy-mm-dd). Set only when `key` is "custom". */
  from?: string;
  to?: string;
}

export const PERIOD_PRESETS: { key: Exclude<PeriodKey, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "last_3_months", label: "Last 3 Months" },
  { key: "this_year", label: "This Year" },
];

export const DEFAULT_PERIOD: DashboardPeriod = { key: "this_month" };

function formatIsoDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** The label shown on the filter trigger. */
export function periodLabel(period: DashboardPeriod): string {
  if (period.key === "custom") {
    if (!period.from || !period.to) return "Custom Range";
    return `${formatIsoDate(period.from)} – ${formatIsoDate(period.to)}`;
  }
  return PERIOD_PRESETS.find((preset) => preset.key === period.key)?.label ?? "This Month";
}

/** Query params for any `/dashboard/...` endpoint taking the shared filter. */
export function periodParams(period: DashboardPeriod): Record<string, string> {
  if (period.key === "custom" && period.from && period.to) {
    return { period: "custom", date_from: period.from, date_to: period.to };
  }
  return { period: period.key === "custom" ? "this_month" : period.key };
}

/** Stable, serializable identity for react-query cache keys. */
export function periodCacheKey(period: DashboardPeriod): string {
  const params = periodParams(period);
  return [params.period, params.date_from ?? "", params.date_to ?? ""].join(":");
}

export function isCompletePeriod(period: DashboardPeriod): boolean {
  return period.key !== "custom" || Boolean(period.from && period.to);
}
