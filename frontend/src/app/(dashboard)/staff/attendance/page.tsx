"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyDailyAttendanceQuery } from "@/hooks/use-attendance";
import { formatAttendanceTime, type AttendanceStatus } from "@/lib/api/attendance";

const STATUS_VARIANT: Record<AttendanceStatus, "success" | "destructive" | "warning" | "muted" | "info"> = {
  present: "success",
  late: "warning",
  half_day: "info",
  leave: "muted",
  absent: "destructive",
};

export default function StaffAttendancePage() {
  const historyQuery = useMyDailyAttendanceQuery();

  const rows = (historyQuery.data ?? []).map((record) => ({
    date: record.attendance_date,
    entry: formatAttendanceTime(record.entry_time),
    exit: formatAttendanceTime(record.exit_time),
    status: <Badge variant={STATUS_VARIANT[record.status]}>{record.status.replace("_", " ")}</Badge>,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My attendance</h1>
        <p className="text-sm text-muted-foreground">Your biometric entry/exit record for the last 7 days.</p>
      </div>

      <DataTable
        title="Recent attendance"
        description="Derived from your biometric entry/exit punches."
        columns={[
          { key: "date", label: "Date" },
          { key: "entry", label: "Entry" },
          { key: "exit", label: "Exit" },
          { key: "status", label: "Status" },
        ]}
        rows={rows}
        isLoading={historyQuery.isLoading}
        isError={historyQuery.isError}
        errorMessage={historyQuery.error ? loginErrorMessage(historyQuery.error) : undefined}
        onRetry={() => historyQuery.refetch()}
        emptyMessage="No biometric attendance recorded in the last 7 days."
        searchValue=""
        onSearchChange={() => {}}
        page={1}
        limit={Math.max(rows.length, 1)}
        total={rows.length}
        onPageChange={() => {}}
      />
    </div>
  );
}
