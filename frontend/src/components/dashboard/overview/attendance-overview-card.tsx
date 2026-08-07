"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/dashboard/overview/chart-tooltip";
import { SectionCard, SectionState } from "@/components/dashboard/overview/section-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { useAttendanceOverviewQuery } from "@/hooks/use-overview";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatPercent } from "@/lib/format";

export interface AttendanceOverviewCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}

export function AttendanceOverviewCard({ period, onPeriodChange }: AttendanceOverviewCardProps) {
  const { data, isLoading, isError } = useAttendanceOverviewQuery(period);
  const points = data?.points ?? [];
  // Buckets with nothing marked come back as 0 — a period where nothing was
  // ever marked is "no data", not "0% attendance".
  const hasRecords = points.some((point) => point.marked > 0);

  return (
    <SectionCard
      title="Attendance Overview"
      action={<PeriodFilter value={period} onChange={onPeriodChange} size="sm" />}
    >
      <SectionState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!hasRecords}
        emptyMessage="No attendance marked for this period."
        skeletonHeight="h-[240px]"
      >
        <div className="mb-4 flex items-baseline gap-3 text-xs text-muted-foreground">
          <span className="text-lg font-bold text-foreground">{formatPercent(data?.average_percent)}</span>
          average across {data?.period?.label?.toLowerCase() ?? "this period"}
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 20, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
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
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value: number) => `${value}%`}
                width={48}
              />
              <RechartsTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={
                  <ChartTooltip
                    seriesNames={{ value: "Attendance" }}
                    formatValue={(value) => `${value}%`}
                  />
                }
              />
              <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={44}>
                <LabelList
                  dataKey="value"
                  position="top"
                  offset={8}
                  className="fill-foreground text-xs font-semibold"
                  formatter={(value) => {
                    const percent = Number(value ?? 0);
                    return percent > 0 ? `${percent}%` : "";
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionState>
    </SectionCard>
  );
}
