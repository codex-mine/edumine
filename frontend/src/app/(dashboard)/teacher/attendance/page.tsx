"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useClassRosterQuery, useMarkClassAttendanceMutation } from "@/hooks/use-attendance";
import { useMyTeacherRoutineQuery } from "@/hooks/use-routine";
import { CLASS_ATTENDANCE_STATUSES, type ClassAttendanceStatus } from "@/lib/api/attendance";
import { WEEKDAY_LABELS } from "@/lib/api/routine";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherAttendancePage() {
  const scheduleQuery = useMyTeacherRoutineQuery();
  const [slotId, setSlotId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [overrides, setOverrides] = useState<Record<string, ClassAttendanceStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const rosterQuery = useClassRosterQuery(slotId, attendanceDate);
  const markMutation = useMarkClassAttendanceMutation();

  function statusFor(studentId: string, defaultStatus: ClassAttendanceStatus | null): ClassAttendanceStatus {
    return overrides[studentId] ?? defaultStatus ?? "present";
  }

  function handleSlotChange(value: string) {
    setSlotId(value);
    setOverrides({});
    setError(null);
    setSavedMessage(null);
  }

  function handleDateChange(value: string) {
    setAttendanceDate(value);
    setOverrides({});
    setError(null);
    setSavedMessage(null);
  }

  async function handleSave() {
    if (!rosterQuery.data) return;
    setError(null);
    setSavedMessage(null);
    try {
      await markMutation.mutateAsync({
        routine_slot_id: rosterQuery.data.routine_slot_id,
        attendance_date: rosterQuery.data.attendance_date,
        items: rosterQuery.data.roster.map((item) => ({
          student_id: item.student_id,
          status: statusFor(item.student_id, item.status),
        })),
      });
      setOverrides({});
      setSavedMessage("Attendance saved.");
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  const slots = scheduleQuery.data ?? [];

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Class attendance</h1>
        <p className="text-sm text-muted-foreground">
          Mark subject-wise attendance for your scheduled periods. The window opens at class start and closes at
          class end.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>Choose one of your scheduled periods and the date.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ta_slot">Period</Label>
            <Select value={slotId || undefined} onValueChange={handleSlotChange}>
              <SelectTrigger id="ta_slot" className="w-full sm:w-[24rem]">
                <SelectValue placeholder="Select a scheduled period" />
              </SelectTrigger>
              <SelectContent>
                {slots.map((slot) => (
                  <SelectItem key={slot.id} value={slot.id}>
                    {WEEKDAY_LABELS[slot.day_of_week]} P{slot.period_number} · {slot.class_name} - {slot.section_name} ·{" "}
                    {slot.subject_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ta_date">Date</Label>
            <Input id="ta_date" type="date" value={attendanceDate} onChange={(e) => handleDateChange(e.target.value)} />
          </div>
        </div>
      </Card>

      {scheduleQuery.isLoading ? (
        <LoadingState label="Loading your schedule..." />
      ) : slots.length === 0 ? (
        <EmptyState message="You have no scheduled periods yet." />
      ) : !slotId ? (
        <Card>
          <CardHeader>
            <CardTitle>No period selected</CardTitle>
            <CardDescription>Choose a scheduled period above to take attendance.</CardDescription>
          </CardHeader>
        </Card>
      ) : rosterQuery.isLoading ? (
        <LoadingState label="Loading roster..." />
      ) : rosterQuery.isError ? (
        <ErrorState message={loginErrorMessage(rosterQuery.error)} onRetry={() => rosterQuery.refetch()} />
      ) : rosterQuery.data ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {rosterQuery.data.section_name} · {rosterQuery.data.subject_name}
            </CardTitle>
            <CardDescription>
              {rosterQuery.data.start_time.slice(0, 5)}–{rosterQuery.data.end_time.slice(0, 5)} on{" "}
              {rosterQuery.data.attendance_date}
            </CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {!rosterQuery.data.window_open && (
              <Alert variant="destructive">
                <AlertTitle>Attendance window closed</AlertTitle>
                <AlertDescription>
                  This period&apos;s attendance window is not currently open — marking is only allowed for today,
                  between the period&apos;s start and end time.
                </AlertDescription>
              </Alert>
            )}

            {rosterQuery.data.roster.length === 0 ? (
              <EmptyState message="No students are enrolled in this section." />
            ) : (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Roll</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Student</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rosterQuery.data.roster.map((item) => (
                      <tr key={item.student_id}>
                        <td className="px-3 py-2">{item.roll_number}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-foreground">{item.student_name}</span>
                          <span className="ml-1 text-xs text-muted-foreground">({item.admission_number})</span>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={statusFor(item.student_id, item.status)}
                            onValueChange={(value) =>
                              setOverrides((prev) => ({ ...prev, [item.student_id]: value as ClassAttendanceStatus }))
                            }
                            disabled={!rosterQuery.data?.window_open}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CLASS_ATTENDANCE_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {savedMessage && <p className="text-sm text-success">{savedMessage}</p>}

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={
                  markMutation.isPending || !rosterQuery.data.window_open || rosterQuery.data.roster.length === 0
                }
              >
                Save attendance
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
