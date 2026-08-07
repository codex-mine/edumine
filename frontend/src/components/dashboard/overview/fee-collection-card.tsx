"use client";

import { DonutChart, DonutLegend } from "@/components/dashboard/overview/donut-chart";
import { SectionCard, SectionState } from "@/components/dashboard/overview/section-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { useFeeCollectionOverviewQuery } from "@/hooks/use-overview";
import type { FeeSegment } from "@/lib/api/overview";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/format";

const SEGMENT_COLORS: Record<FeeSegment["key"], string> = {
  collected: "var(--success)",
  pending: "var(--warning)",
  overdue: "var(--destructive)",
};

export interface FeeCollectionCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}

export function FeeCollectionCard({ period, onPeriodChange }: FeeCollectionCardProps) {
  const { data, isLoading, isError } = useFeeCollectionOverviewQuery(period);
  const segments = data?.segments ?? [];

  return (
    <SectionCard
      title="Fee Collection"
      action={<PeriodFilter value={period} onChange={onPeriodChange} size="sm" />}
    >
      <SectionState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data || data.total === 0}
        emptyMessage="No billing activity for this period."
        skeletonHeight="h-[220px]"
      >
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <DonutChart
            data={segments
              // A zero slice renders as an invisible wedge that still steals a
              // tooltip target — drop it and let the legend carry the ৳ 0.
              .filter((segment) => segment.amount > 0)
              .map((segment) => ({
                label: segment.label,
                value: segment.amount,
                color: SEGMENT_COLORS[segment.key] ?? "var(--muted-foreground)",
              }))}
            centerValue={formatCompactCurrency(data?.collected ?? 0)}
            centerLabel="Total Collected"
            formatValue={(value) => formatCurrency(value)}
          />
          <DonutLegend
            items={segments.map((segment) => ({
              label: segment.label,
              color: SEGMENT_COLORS[segment.key] ?? "var(--muted-foreground)",
              primary: formatCurrency(segment.amount),
              secondary: `(${formatPercent(segment.percent, 0)})`,
            }))}
          />
        </div>
      </SectionState>
    </SectionCard>
  );
}
