"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import {
  DetailSection,
  SimpleTable,
  StatGrid,
  StatTile,
} from "@/components/modules/people/detail/detail-shell";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useDailyAttendanceQuery } from "@/hooks/use-attendance";
import type { AttendanceStatus } from "@/lib/api/attendance";

const STATUS_VARIANT: Record<AttendanceStatus, "success" | "warning" | "destructive" | "muted"> = {
  present: "success",
  late: "warning",
  absent: "destructive",
  half_day: "muted",
  leave: "muted",
};

/** Biometric daily attendance over a date range. Keyed on `user_id`, so the same
 * panel serves students, teachers, and staff. */
export function AttendancePanel({
  userId,
  dateFrom,
  dateTo,
  periodLabel,
}: {
  userId: string;
  dateFrom?: string;
  dateTo?: string;
  periodLabel?: string;
}) {
  const query = useDailyAttendanceQuery({ user_id: userId, date_from: dateFrom, date_to: dateTo });
  const records = query.data ?? [];

  const counts = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, {});
  const presentish = (counts.present ?? 0) + (counts.late ?? 0) + (counts.half_day ?? 0);
  const rate = records.length > 0 ? Math.round((presentish / records.length) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile
          label="Attendance rate"
          value={rate === null ? "—" : `${rate}%`}
          hint={periodLabel}
          tone={rate === null ? "default" : rate >= 90 ? "positive" : rate >= 75 ? "warning" : "negative"}
        />
        <StatTile label="Present" value={counts.present ?? 0} tone="positive" />
        <StatTile label="Late" value={counts.late ?? 0} tone="warning" />
        <StatTile label="Absent" value={counts.absent ?? 0} tone="negative" />
      </StatGrid>

      <DetailSection
        title="Daily attendance"
        description={
          periodLabel ? `Biometric records for ${periodLabel}.` : "Biometric records for the selected period."
        }
      >
        {query.isPending ? (
          <LoadingState label="Loading attendance..." />
        ) : query.isError ? (
          <ErrorState message={loginErrorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : records.length === 0 ? (
          <EmptyState message="No attendance recorded for this period." />
        ) : (
          <SimpleTable
            headers={["Date", "Entry", "Exit", "Status"]}
            rows={records.map((record) => [
              new Date(record.attendance_date).toLocaleDateString(),
              record.entry_time ?? "—",
              record.exit_time ?? "—",
              <Badge key={record.id} variant={STATUS_VARIANT[record.status] ?? "muted"}>
                {record.status.replace(/_/g, " ")}
              </Badge>,
            ])}
          />
        )}
      </DetailSection>
    </div>
  );
}
