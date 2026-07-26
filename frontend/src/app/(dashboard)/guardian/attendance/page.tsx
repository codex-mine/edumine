"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useStudentCombinedDailyQuery } from "@/hooks/use-attendance";
import { useOwnGuardianProfileQuery } from "@/hooks/use-guardians";
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

export default function GuardianAttendancePage() {
  const profileQuery = useOwnGuardianProfileQuery();
  const [studentId, setStudentId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayIso());

  const children = profileQuery.data?.students ?? [];
  const resolvedStudentId = studentId || children[0]?.student_id || "";

  const combinedQuery = useStudentCombinedDailyQuery(resolvedStudentId, attendanceDate);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Children&apos;s attendance</h1>
        <p className="text-sm text-muted-foreground">Biometric entry/exit combined with subject-wise attendance.</p>
      </div>

      {profileQuery.isLoading ? (
        <LoadingState label="Loading your profile..." />
      ) : children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No linked children found</CardTitle>
            <CardDescription>Once a child is linked to your account, their attendance appears here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
              <CardDescription>Choose a child and date.</CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ga_child">Child</Label>
                <Select value={resolvedStudentId || undefined} onValueChange={setStudentId}>
                  <SelectTrigger id="ga_child" className="w-full sm:w-[18rem]">
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.student_id} value={child.student_id}>
                        {child.full_name} ({child.admission_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ga_date">Date</Label>
                <Input id="ga_date" type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily summary — {attendanceDate}</CardTitle>
              <CardDescription>Biometric entry/exit and each scheduled period for the day.</CardDescription>
            </CardHeader>
            <div className="px-4 pb-4">
              {combinedQuery.isLoading ? (
                <LoadingState label="Loading attendance..." />
              ) : combinedQuery.isError ? (
                <ErrorState message={loginErrorMessage(combinedQuery.error)} onRetry={() => combinedQuery.refetch()} />
              ) : combinedQuery.data ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-4 rounded border border-border p-3 text-sm">
                    <span>
                      Entry:{" "}
                      <span className="font-medium text-foreground">{formatAttendanceTime(combinedQuery.data.entry_time)}</span>
                    </span>
                    <span>
                      Exit:{" "}
                      <span className="font-medium text-foreground">{formatAttendanceTime(combinedQuery.data.exit_time)}</span>
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
        </>
      )}
    </div>
  );
}
