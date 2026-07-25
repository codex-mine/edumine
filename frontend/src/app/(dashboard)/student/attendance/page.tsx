"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyDailyAttendanceQuery } from "@/hooks/use-attendance";
import { useOwnStudentProfileQuery } from "@/hooks/use-students";
import { useStudentCombinedDailyQuery } from "@/hooks/use-attendance";
import { formatAttendanceTime, type AttendanceStatus } from "@/lib/api/attendance";

const STATUS_VARIANT: Record<AttendanceStatus, "success" | "destructive" | "warning" | "muted" | "info"> = {
  present: "success",
  late: "warning",
  half_day: "info",
  leave: "muted",
  absent: "destructive",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentAttendancePage() {
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const profileQuery = useOwnStudentProfileQuery();
  const studentId = profileQuery.data?.id ?? "";

  const combinedQuery = useStudentCombinedDailyQuery(studentId, attendanceDate);
  const historyQuery = useMyDailyAttendanceQuery();

  const historyRows = (historyQuery.data ?? []).map((record) => ({
    date: record.attendance_date,
    entry: formatAttendanceTime(record.entry_time),
    exit: formatAttendanceTime(record.exit_time),
    status: <Badge variant={STATUS_VARIANT[record.status]}>{record.status.replace("_", " ")}</Badge>,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My attendance</h1>
        <p className="text-sm text-muted-foreground">Your biometric entry/exit combined with subject-wise attendance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date</CardTitle>
          <CardDescription>Choose a date to view your combined daily attendance.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-1.5 px-4 pb-4 sm:w-64">
          <Label htmlFor="sa_date">Date</Label>
          <Input id="sa_date" type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily summary — {attendanceDate}</CardTitle>
          <CardDescription>Biometric entry/exit and each scheduled period for the day.</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          {profileQuery.isLoading || combinedQuery.isLoading ? (
            <LoadingState label="Loading attendance..." />
          ) : combinedQuery.isError ? (
            <ErrorState message={loginErrorMessage(combinedQuery.error)} onRetry={() => combinedQuery.refetch()} />
          ) : combinedQuery.data ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-4 rounded border border-border p-3 text-sm">
                <span>
                  Entry: <span className="font-medium text-foreground">{formatAttendanceTime(combinedQuery.data.entry_time)}</span>
                </span>
                <span>
                  Exit: <span className="font-medium text-foreground">{formatAttendanceTime(combinedQuery.data.exit_time)}</span>
                </span>
                <span>
                  Status:{" "}
                  {combinedQuery.data.biometric_status ? (
                    <Badge variant={STATUS_VARIANT[combinedQuery.data.biometric_status]}>
                      {combinedQuery.data.biometric_status.replace("_", " ")}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">No punch recorded</span>
                  )}
                </span>
              </div>

              {combinedQuery.data.periods.length === 0 ? (
                <EmptyState message="No periods scheduled for this date." />
              ) : (
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Period</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Subject</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Teacher</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Time</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {combinedQuery.data.periods.map((period) => (
                        <tr key={period.routine_slot_id}>
                          <td className="px-3 py-2">{period.period_number}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{period.subject_name}</td>
                          <td className="px-3 py-2">{period.teacher_name}</td>
                          <td className="px-3 py-2">
                            {period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)}
                          </td>
                          <td className="px-3 py-2">
                            {period.status ? (
                              <Badge variant={STATUS_VARIANT[period.status]}>{period.status}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not marked</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Card>

      <DataTable
        title="Recent biometric attendance"
        description="Your last 7 days of entry/exit records."
        columns={[
          { key: "date", label: "Date" },
          { key: "entry", label: "Entry" },
          { key: "exit", label: "Exit" },
          { key: "status", label: "Status" },
        ]}
        rows={historyRows}
        isLoading={historyQuery.isLoading}
        isError={historyQuery.isError}
        errorMessage={historyQuery.error ? loginErrorMessage(historyQuery.error) : undefined}
        onRetry={() => historyQuery.refetch()}
        emptyMessage="No biometric attendance recorded in the last 7 days."
        searchValue=""
        onSearchChange={() => {}}
        page={1}
        limit={Math.max(historyRows.length, 1)}
        total={historyRows.length}
        onPageChange={() => {}}
      />
    </div>
  );
}
