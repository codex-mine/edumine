"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";

import { SectionCard, SectionState } from "@/components/dashboard/overview/section-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { useRecentNotificationsQuery } from "@/hooks/use-overview";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatRelativeTime } from "@/lib/format";

export interface RecentNotificationsCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  communicationHref: string;
}

export function RecentNotificationsCard({
  period,
  onPeriodChange,
  communicationHref,
}: RecentNotificationsCardProps) {
  const { data, isLoading, isError } = useRecentNotificationsQuery(period);
  const notifications = data?.notifications ?? [];

  return (
    <SectionCard
      title="Recent Notifications"
      link={{ label: "View All", href: communicationHref }}
      action={<PeriodFilter value={period} onChange={onPeriodChange} size="sm" />}
    >
      <SectionState
        isLoading={isLoading}
        isError={isError}
        isEmpty={notifications.length === 0}
        emptyMessage="No announcements published in this period."
        skeletonHeight="h-48"
      >
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                href={`${communicationHref}/${notification.id}`}
                className="flex items-start gap-4 rounded px-3 py-3 transition-colors hover:bg-muted"
              >
                <span className="flex size-16 shrink-0 items-center justify-center rounded bg-success/10 text-success">
                  <Megaphone className="size-8" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm text-foreground">{notification.title}</span>
                  <span className="text-xs text-muted-foreground">{notification.audience}</span>
                </span>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                  {formatRelativeTime(notification.at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionState>
    </SectionCard>
  );
}
