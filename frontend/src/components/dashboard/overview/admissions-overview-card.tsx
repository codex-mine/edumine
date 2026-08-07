"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/dashboard/overview/chart-tooltip";
import { SectionCard, SectionState } from "@/components/dashboard/overview/section-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { useAdmissionsOverviewQuery } from "@/hooks/use-overview";
import type { DashboardPeriod } from "@/lib/dashboard-period";

export interface AdmissionsOverviewCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}

export function AdmissionsOverviewCard({ period, onPeriodChange }: AdmissionsOverviewCardProps) {
  const { data, isLoading, isError } = useAdmissionsOverviewQuery(period);
  const points = data?.points ?? [];
  const currentLabel = data?.period?.label ?? "Current";
  const previousLabel = data?.comparison_label ?? "Previous";

  return (
    <SectionCard
      title="Admissions Overview"
      action={<PeriodFilter value={period} onChange={onPeriodChange} size="sm" />}
    >
      <SectionState
        isLoading={isLoading}
        isError={isError}
        isEmpty={points.length === 0 || ((data?.total ?? 0) === 0 && (data?.previous_total ?? 0) === 0)}
        emptyMessage="No admissions recorded for this period."
        skeletonHeight="h-[240px]"
      >
        <div className="mb-4 flex items-center gap-8 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-1 w-8 rounded-full bg-primary" aria-hidden="true" />
            {currentLabel}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-0 w-8 border-t-2 border-dashed border-muted-foreground/70"
              aria-hidden="true"
            />
            {previousLabel}
          </span>
        </div>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="admissionsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={44}
              />
              <RechartsTooltip
                cursor={{ stroke: "var(--primary)", strokeDasharray: "4 4", strokeOpacity: 0.5 }}
                content={
                  <ChartTooltip seriesNames={{ current: currentLabel, previous: previousLabel }} />
                }
              />
              <Area
                type="monotone"
                dataKey="current"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#admissionsFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              />
              <Line
                type="monotone"
                dataKey="previous"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--card)" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionState>
    </SectionCard>
  );
}
