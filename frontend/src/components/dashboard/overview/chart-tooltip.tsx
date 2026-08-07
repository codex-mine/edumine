"use client";

export interface ChartTooltipEntry {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipEntry[];
  /** Overrides the series name shown per row, keyed by dataKey. */
  seriesNames?: Record<string, string>;
  formatValue?: (value: number | string | undefined, entry: ChartTooltipEntry) => string;
}

/** Shared recharts tooltip: a titled card with one colour-dotted row per series. */
export function ChartTooltip({ active, label, payload, seriesNames, formatValue }: ChartTooltipProps) {
  // Gap points (null) carry no reading — drop the row rather than showing blank.
  const rows = payload?.filter((entry) => entry.value !== null && entry.value !== undefined) ?? [];
  if (!active || rows.length === 0) return null;

  return (
    <div className="min-w-40 rounded border border-border bg-popover px-4 py-3 text-xs shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
      {label !== undefined && <p className="mb-2 font-medium text-foreground">{label}</p>}
      <div className="flex flex-col gap-1.5">
        {rows.map((entry, index) => (
          <div key={`${entry.dataKey ?? index}`} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-4 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              {seriesNames?.[String(entry.dataKey)] ?? entry.name ?? String(entry.dataKey)}
            </span>
            <span className="font-semibold text-foreground">
              {formatValue ? formatValue(entry.value, entry) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
