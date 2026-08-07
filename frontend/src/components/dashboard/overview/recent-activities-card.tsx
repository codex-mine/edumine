"use client";

import { SectionCard, SectionState } from "@/components/dashboard/overview/section-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { useRecentActivitiesQuery } from "@/hooks/use-overview";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatRelativeTime } from "@/lib/format";

export interface RecentActivitiesCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}

export function RecentActivitiesCard({ period, onPeriodChange }: RecentActivitiesCardProps) {
  const { data, isLoading, isError } = useRecentActivitiesQuery(period);
  const activities = data?.activities ?? [];

  return (
    <SectionCard
      title="Recent Activities"
      action={<PeriodFilter value={period} onChange={onPeriodChange} size="sm" />}
      contentClassName="px-0"
    >
      <SectionState
        isLoading={isLoading}
        isError={isError}
        isEmpty={activities.length === 0}
        emptyMessage="No recorded activity in this period."
        skeletonHeight="h-64"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-10 py-3 text-xs font-medium text-muted-foreground">Activity</th>
                <th className="px-10 py-3 text-xs font-medium text-muted-foreground">Details</th>
                <th className="px-10 py-3 text-right text-xs font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activities.map((activity) => (
                <tr key={activity.id} className="hover:bg-muted/50">
                  <td className="px-10 py-4 font-medium text-foreground">{activity.activity}</td>
                  <td className="px-10 py-4 text-muted-foreground">{activity.actor}</td>
                  <td className="px-10 py-4 text-right whitespace-nowrap text-muted-foreground">
                    {formatRelativeTime(activity.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionState>
    </SectionCard>
  );
}
