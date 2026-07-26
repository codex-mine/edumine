"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxUi } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { InsightSummaryCard } from "@/components/modules/results/insight-summary-card";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMarksRosterQuery, useSaveMarksMutation, useSubjectInsightMutation, useSubmitMarksMutation } from "@/hooks/use-results";
import type { MarkEntryItem } from "@/lib/api/results";

interface RowState {
  marks_obtained: string;
  is_absent: boolean;
}

export default function TeacherMarksEntryPage() {
  const params = useParams<{ examSubjectId: string }>();
  const router = useRouter();
  const examSubjectId = params.examSubjectId;

  const rosterQuery = useMarksRosterQuery(examSubjectId);
  const saveMutation = useSaveMarksMutation(examSubjectId);
  const submitMutation = useSubmitMarksMutation(examSubjectId);
  const insightMutation = useSubjectInsightMutation();

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const roster = rosterQuery.data;

  // Seed editable row state from the loaded roster exactly once per exam
  // subject — set during render so a background refetch never clobbers
  // in-progress edits (same pattern as the exam question workspace).
  if (roster && roster.exam_subject_id !== loadedId) {
    setLoadedId(roster.exam_subject_id);
    const initial: Record<string, RowState> = {};
    for (const student of roster.students) {
      initial[student.student_id] = {
        marks_obtained: student.marks_obtained !== null ? String(student.marks_obtained) : "",
        is_absent: student.is_absent,
      };
    }
    setRows(initial);
  }

  function updateRow(studentId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  function buildItems(): MarkEntryItem[] {
    return Object.entries(rows).map(([studentId, row]) => ({
      student_id: studentId,
      is_absent: row.is_absent,
      marks_obtained: row.is_absent || row.marks_obtained === "" ? null : Number(row.marks_obtained),
    }));
  }

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);
    const items = buildItems().filter((item) => item.is_absent || item.marks_obtained !== null);
    if (items.length === 0) {
      setSaveError("Enter at least one student's marks before saving.");
      return;
    }
    try {
      await saveMutation.mutateAsync(items);
      setSaveSuccess(true);
    } catch (mutationError) {
      setSaveError(loginErrorMessage(mutationError));
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await submitMutation.mutateAsync();
      setSubmitSuccess(true);
    } catch (mutationError) {
      setSubmitError(loginErrorMessage(mutationError));
    }
  }

  if (rosterQuery.isLoading) return <LoadingState label="Loading roster..." />;
  if (rosterQuery.isError || !roster) {
    return <ErrorState message={loginErrorMessage(rosterQuery.error)} onRetry={() => rosterQuery.refetch()} />;
  }

  const allEntered = roster.students.every((s) => {
    const row = rows[s.student_id];
    return row && (row.is_absent || row.marks_obtained !== "");
  });
  const canSubmit = allEntered && !roster.is_overdue;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/teacher/results")}>
          ← Back to assignments
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {roster.subject_name} — {roster.class_name}
          </h1>
          {roster.marks_submitted_at ? (
            <Badge variant="success">Submitted</Badge>
          ) : roster.is_overdue ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : (
            <Badge variant="warning">Pending</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {roster.exam_name} · Full marks {roster.full_marks} · Pass marks {roster.pass_marks} · Deadline{" "}
          {new Date(roster.marks_deadline).toLocaleString()}
        </p>
      </div>

      {roster.is_overdue && !roster.marks_submitted_at && (
        <ErrorState message="The marks submission deadline has passed. Contact an admin if you still need to submit." />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Student marks</CardTitle>
          <CardDescription>Enter marks or mark a student absent. Save as you go, then submit when complete.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Roll</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Section</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Marks</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roster.students.map((student) => {
                  const row = rows[student.student_id] ?? { marks_obtained: "", is_absent: false };
                  return (
                    <tr key={student.student_id}>
                      <td className="px-3 py-2">{student.roll_number}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{student.full_name}</td>
                      <td className="px-3 py-2">{student.section_name}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={roster.full_marks}
                          className="w-24"
                          disabled={row.is_absent || Boolean(roster.marks_submitted_at)}
                          value={row.marks_obtained}
                          onChange={(e) => updateRow(student.student_id, { marks_obtained: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <CheckboxUi
                          checked={row.is_absent}
                          disabled={Boolean(roster.marks_submitted_at)}
                          onCheckedChange={(checked) =>
                            updateRow(student.student_id, {
                              is_absent: checked === true,
                              marks_obtained: checked === true ? "" : row.marks_obtained,
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          {saveSuccess && <p className="text-sm text-success">Marks saved.</p>}
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          {submitSuccess && <p className="text-sm text-success">Marks submitted.</p>}

          {!roster.marks_submitted_at && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save marks"}
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || submitMutation.isPending}>
                {submitMutation.isPending ? "Submitting..." : "Submit marks"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {roster.exam_status === "published" && (
        <InsightSummaryCard
          title="Class insight summary"
          description={`Plain-language summary of published ${roster.subject_name} results for ${roster.class_name}.`}
          onGenerate={() => insightMutation.mutateAsync(examSubjectId)}
          isPending={insightMutation.isPending}
        />
      )}
    </div>
  );
}
