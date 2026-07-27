"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useCommunicationSectionsQuery } from "@/hooks/use-communication";
import { useAtRiskStudentsMutation } from "@/hooks/use-dashboard";
import { useExamsQuery } from "@/hooks/use-exams";

function defaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

/** Section 4.7 — At-Risk Student Recommendation. Thresholds are always caller-supplied,
 * never AI-decided, per prompts.md §4.7. */
export function AtRiskStudentsWidget() {
  const [sectionId, setSectionId] = useState("");
  const [useAttendance, setUseAttendance] = useState(true);
  const [attendanceThreshold, setAttendanceThreshold] = useState("75");
  const { from, to } = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(from);
  const [dateTo, setDateTo] = useState(to);
  const [useMarks, setUseMarks] = useState(false);
  const [marksThreshold, setMarksThreshold] = useState("40");
  const [examId, setExamId] = useState("");

  const sectionsQuery = useCommunicationSectionsQuery();
  const examsQuery = useExamsQuery();
  const publishedExams = (examsQuery.data ?? []).filter((exam) => exam.status === "published");
  const mutation = useAtRiskStudentsMutation();

  const canGenerate = Boolean(sectionId) && (useAttendance || (useMarks && examId));

  function handleGenerate() {
    mutation.reset();
    if (!canGenerate) return;
    mutation.mutate({
      section_id: sectionId,
      attendance_threshold_percent: useAttendance ? Number(attendanceThreshold) : undefined,
      attendance_date_from: useAttendance ? dateFrom : undefined,
      attendance_date_to: useAttendance ? dateTo : undefined,
      marks_threshold_percent: useMarks && examId ? Number(marksThreshold) : undefined,
      exam_id: useMarks && examId ? examId : undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          At-risk student recommendation
        </CardTitle>
        <CardDescription>A follow-up worklist against thresholds you set — never a label on the student.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Section</Label>
          <Select value={sectionId || undefined} onValueChange={setSectionId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a section" />
            </SelectTrigger>
            <SelectContent>
              {(sectionsQuery.data ?? []).map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={useAttendance} onChange={(e) => setUseAttendance(e.target.checked)} />
            Attendance below threshold
          </label>
          {useAttendance && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Threshold (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={attendanceThreshold}
                  onChange={(e) => setAttendanceThreshold(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={useMarks} onChange={(e) => setUseMarks(e.target.checked)} />
            Average marks below threshold (published exams only)
          </label>
          {useMarks && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Exam</Label>
                <Select value={examId || undefined} onValueChange={setExamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a published exam" />
                  </SelectTrigger>
                  <SelectContent>
                    {publishedExams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Threshold (%)</Label>
                <Input type="number" min={0} max={100} value={marksThreshold} onChange={(e) => setMarksThreshold(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <Button size="sm" className="w-fit" disabled={!canGenerate || mutation.isPending} onClick={handleGenerate}>
          {mutation.isPending ? "Evaluating..." : "Generate worklist"}
        </Button>

        {mutation.isError && <ErrorState message={loginErrorMessage(mutation.error)} />}

        {mutation.isSuccess && (
          mutation.data.flagged_students.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {mutation.data.flagged_students.map((flagged) => {
                const student = mutation.data.students.find((s) => s.student_id === flagged.student_id);
                return (
                  <li key={flagged.student_id} className="flex flex-col gap-0.5 p-3 text-sm">
                    <span className="font-medium text-foreground">{student?.name ?? flagged.student_id}</span>
                    <span className="text-muted-foreground">{flagged.reason}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState message="No students currently meet the selected criteria." />
          )
        )}
      </CardContent>
    </Card>
  );
}
