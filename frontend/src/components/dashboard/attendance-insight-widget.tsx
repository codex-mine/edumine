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
import { useAttendanceInsightMutation } from "@/hooks/use-dashboard";
import { useStudentsQuery } from "@/hooks/use-students";

function defaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 13);
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

/** Section 4.5 — Attendance Pattern Insight, surfaced as an on-demand Admin/Teacher widget. */
export function AttendanceInsightWidget() {
  const [scope, setScope] = useState<"class" | "student">("class");
  const [sectionId, setSectionId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const { from, to } = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(from);
  const [dateTo, setDateTo] = useState(to);

  const sectionsQuery = useCommunicationSectionsQuery(scope === "class");
  const studentsQuery = useStudentsQuery({ page: 1, limit: 10, search: studentSearch || undefined });
  const mutation = useAttendanceInsightMutation();

  function handleGenerate() {
    mutation.reset();
    if (scope === "class" && sectionId) {
      mutation.mutate({ scope: "class", section_id: sectionId, date_from: dateFrom, date_to: dateTo });
    } else if (scope === "student" && studentId) {
      mutation.mutate({ scope: "student", student_id: studentId, date_from: dateFrom, date_to: dateTo });
    }
  }

  const canGenerate = (scope === "class" && Boolean(sectionId)) || (scope === "student" && Boolean(studentId));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-8 text-primary" aria-hidden="true" />
          Attendance pattern insight
        </CardTitle>
        <CardDescription>Neutral statistical observations only — never a conclusion about the student.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(value) => setScope(value as "class" | "student")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Class / section</SelectItem>
                <SelectItem value="student">Individual student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "class" ? (
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
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Student</Label>
              <Input
                placeholder="Search by name or admission #"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setStudentId("");
                }}
              />
              {studentSearch && (studentsQuery.data?.items.length ?? 0) > 0 && !studentId && (
                <Select value={studentId || undefined} onValueChange={setStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a match" />
                  </SelectTrigger>
                  <SelectContent>
                    {(studentsQuery.data?.items ?? []).map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.full_name} ({student.admission_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <Button className="w-fit" disabled={!canGenerate || mutation.isPending} onClick={handleGenerate}>
          {mutation.isPending ? "Analyzing..." : "Generate insight"}
        </Button>

        {mutation.isError && <ErrorState message={loginErrorMessage(mutation.error)} />}

        {mutation.isSuccess && (
          mutation.data.observations.length > 0 ? (
            <ul className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
              {mutation.data.observations.map((observation, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{observation}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No notable attendance patterns found for this period." />
          )
        )}
      </CardContent>
    </Card>
  );
}
