"use client";

import { DonutChart, DonutLegend } from "@/components/dashboard/overview/donut-chart";
import { SectionCard, SectionState } from "@/components/dashboard/overview/section-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { useStudentsByClassQuery } from "@/hooks/use-overview";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatNumber, formatPercent } from "@/lib/format";

/** Classes are unbounded in number, so the palette cycles. */
const CLASS_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export interface StudentsByClassCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}

export function StudentsByClassCard({ period, onPeriodChange }: StudentsByClassCardProps) {
  const { data, isLoading, isError } = useStudentsByClassQuery(period);
  // Colour is assigned before any filtering so a class keeps the same swatch in
  // the ring and the legend even when an empty class sits between them.
  const segments = (data?.segments ?? []).map((segment, index) => ({
    ...segment,
    color: CLASS_COLORS[index % CLASS_COLORS.length],
  }));

  return (
    <SectionCard
      title="Students by Class"
      action={<PeriodFilter value={period} onChange={onPeriodChange} size="sm" />}
    >
      <SectionState
        isLoading={isLoading}
        isError={isError}
        isEmpty={segments.length === 0 || (data?.total ?? 0) === 0}
        emptyMessage="No active enrollments yet."
        skeletonHeight="h-[220px]"
      >
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <DonutChart
            data={segments
              .filter((segment) => segment.value > 0)
              .map((segment) => ({
                label: `Class ${segment.label}`,
                value: segment.value,
                color: segment.color,
              }))}
            centerValue={formatNumber(data?.total ?? 0)}
            centerLabel={data?.academic_year ? `Students · ${data.academic_year}` : "Students"}
            formatValue={(value) => formatNumber(value)}
          />
          <DonutLegend
            items={segments.map((segment) => ({
              label: `Class ${segment.label}`,
              color: segment.color,
              primary: formatNumber(segment.value),
              secondary: `(${formatPercent(segment.percent, 0)})`,
            }))}
          />
        </div>
      </SectionState>
    </SectionCard>
  );
}
