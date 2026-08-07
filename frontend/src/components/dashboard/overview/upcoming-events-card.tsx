"use client";

import Link from "next/link";

import { SectionCard, SectionState } from "@/components/dashboard/overview/section-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { useUpcomingEventsQuery } from "@/hooks/use-overview";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatDayNumber, formatMonthShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Date chips cycle through the accent palette so consecutive events stay
 * visually separable, exactly as in the design. */
const CHIP_TONES = [
  "bg-primary/10 text-primary",
  "bg-success/10 text-success",
  "bg-warning/10 text-warning",
  "bg-info/10 text-info",
];

export interface UpcomingEventsCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  eventsHref: string;
}

export function UpcomingEventsCard({ period, onPeriodChange, eventsHref }: UpcomingEventsCardProps) {
  const { data, isLoading, isError } = useUpcomingEventsQuery(period);
  const events = data?.events ?? [];

  return (
    <SectionCard
      title="Upcoming Events"
      link={{ label: "View All", href: eventsHref }}
      action={<PeriodFilter value={period} onChange={onPeriodChange} size="sm" />}
    >
      <SectionState
        isLoading={isLoading}
        isError={isError}
        isEmpty={events.length === 0}
        emptyMessage="No events scheduled for this period."
        skeletonHeight="h-64"
      >
        <ul className="flex flex-col gap-3">
          {events.map((event, index) => (
            <li key={event.id}>
              <Link
                href={eventsHref}
                className="flex items-center gap-4 rounded px-3 py-3 transition-colors hover:bg-muted"
              >
                <span
                  className={cn(
                    "flex size-20 shrink-0 flex-col items-center justify-center rounded leading-none",
                    CHIP_TONES[index % CHIP_TONES.length]
                  )}
                >
                  <span className="text-sm font-bold">{formatDayNumber(event.date)}</span>
                  <span className="text-[10px] font-medium">{formatMonthShort(event.date)}</span>
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium text-foreground">{event.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {event.timing} · {event.status}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionState>
    </SectionCard>
  );
}
