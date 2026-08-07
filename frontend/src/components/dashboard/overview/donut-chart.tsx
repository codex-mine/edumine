"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

import { ChartTooltip } from "@/components/dashboard/overview/chart-tooltip";
import { cn } from "@/lib/utils";

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  /** Large figure in the ring's centre. */
  centerValue?: string;
  centerLabel?: string;
  formatValue?: (value: number) => string;
  className?: string;
}

/** Ring chart with a centred readout, shared by the fee and enrollment cards. */
export function DonutChart({ data, centerValue, centerLabel, formatValue, className }: DonutChartProps) {
  return (
    <div className={cn("relative aspect-square w-full max-w-[220px] shrink-0", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((datum) => (
              <Cell key={datum.label} fill={datum.color} />
            ))}
          </Pie>
          <RechartsTooltip
            content={
              <ChartTooltip
                formatValue={(value) =>
                  formatValue ? formatValue(Number(value ?? 0)) : String(value ?? "")
                }
              />
            }
          />
        </PieChart>
      </ResponsiveContainer>

      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          {centerValue && <span className="text-lg font-bold text-foreground">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

export interface DonutLegendItem {
  label: string;
  color: string;
  primary: string;
  secondary?: string;
}

export function DonutLegend({ items }: { items: DonutLegendItem[] }) {
  return (
    <ul className="flex min-w-0 flex-1 flex-col justify-center gap-5">
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-1">
          <span className="flex items-center gap-3 text-sm text-foreground">
            <span
              className="size-5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="truncate">{item.label}</span>
          </span>
          <span className="pl-8 text-sm font-semibold text-foreground">
            {item.primary}
            {item.secondary && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">{item.secondary}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
