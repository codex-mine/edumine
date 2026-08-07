"use client";

import { SectionCard, SectionState } from "@/components/dashboard/overview/section-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { useTopStudentsQuery } from "@/hooks/use-overview";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatNumber, formatPercent, initialsOf } from "@/lib/format";

export interface TopStudentsCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  resultsHref: string;
}

export function TopStudentsCard({ period, onPeriodChange, resultsHref }: TopStudentsCardProps) {
  const { data, isLoading, isError } = useTopStudentsQuery(period);
  const students = data?.students ?? [];

  return (
    <SectionCard
      title="Top Performing Students"
      link={{ label: "View All", href: resultsHref }}
      action={<PeriodFilter value={period} onChange={onPeriodChange} size="sm" />}
      contentClassName="px-0"
    >
      <SectionState
        isLoading={isLoading}
        isError={isError}
        isEmpty={students.length === 0}
        emptyMessage="No published results in this period."
        skeletonHeight="h-64"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-10 py-3 text-xs font-medium text-muted-foreground">Student</th>
                <th className="px-10 py-3 text-xs font-medium text-muted-foreground">Class</th>
                <th className="px-10 py-3 text-right text-xs font-medium text-muted-foreground">Score</th>
                <th className="px-10 py-3 text-right text-xs font-medium text-muted-foreground">GPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((student) => (
                <tr key={student.student_id} className="hover:bg-muted/50">
                  <td className="px-10 py-4">
                    <span className="flex items-center gap-4">
                      <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initialsOf(student.name)}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-medium text-foreground">{student.name}</span>
                        <span className="text-xs text-muted-foreground">Rank #{student.rank}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-10 py-4 text-muted-foreground">{student.class_label ?? "—"}</td>
                  <td className="px-10 py-4 text-right font-medium text-foreground">
                    {formatPercent(student.percentage, 2)}
                  </td>
                  <td className="px-10 py-4 text-right font-semibold text-success">
                    {formatNumber(student.gpa, 2)}
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
