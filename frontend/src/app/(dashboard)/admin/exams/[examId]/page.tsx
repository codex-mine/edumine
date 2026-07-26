"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxUi } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ExtendDeadlineDialog } from "@/components/modules/exams/extend-deadline-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useCandidateSubjectsQuery, useConfigureExamSubjectsMutation, useExamQuery } from "@/hooks/use-exams";
import { EXAM_STATUS_LABELS, type ExamStatus } from "@/lib/api/exams";

const STATUS_BADGE_VARIANT: Record<ExamStatus, "muted" | "warning" | "success" | "info"> = {
  draft: "muted",
  question_pending: "warning",
  ready: "success",
  results_pending: "info",
  published: "info",
};

interface RowConfig {
  selected: boolean;
  full_marks: number;
  pass_marks: number;
  question_deadline: string;
  marks_deadline: string;
}

function defaultRowConfig(defaultFullMarks: number): RowConfig {
  return {
    selected: false,
    full_marks: defaultFullMarks,
    pass_marks: Math.round(defaultFullMarks * 0.33),
    question_deadline: "",
    marks_deadline: "",
  };
}

export default function ExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;

  const examQuery = useExamQuery(examId);
  const candidatesQuery = useCandidateSubjectsQuery(examId);
  const configureMutation = useConfigureExamSubjectsMutation(examId);

  const [rowConfigs, setRowConfigs] = useState<Record<string, RowConfig>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function rowKey(classId: string, subjectId: string) {
    return `${classId}:${subjectId}`;
  }

  function configFor(classId: string, subjectId: string, defaultFullMarks: number): RowConfig {
    return rowConfigs[rowKey(classId, subjectId)] ?? defaultRowConfig(defaultFullMarks);
  }

  function updateRow(classId: string, subjectId: string, defaultFullMarks: number, patch: Partial<RowConfig>) {
    const key = rowKey(classId, subjectId);
    setRowConfigs((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultRowConfig(defaultFullMarks)), ...patch },
    }));
  }

  async function handleConfigureSelected() {
    setFormError(null);
    const pendingCandidates = (candidatesQuery.data ?? []).filter((c) => !c.exam_subject_id);
    const items = pendingCandidates
      .filter((c) => configFor(c.class_id, c.subject_id, c.default_full_marks).selected)
      .map((c) => {
        const cfg = configFor(c.class_id, c.subject_id, c.default_full_marks);
        return {
          class_id: c.class_id,
          subject_id: c.subject_id,
          full_marks: cfg.full_marks,
          pass_marks: cfg.pass_marks,
          question_deadline: cfg.question_deadline ? new Date(cfg.question_deadline).toISOString() : "",
          marks_deadline: cfg.marks_deadline ? new Date(cfg.marks_deadline).toISOString() : "",
        };
      });

    if (items.length === 0) {
      setFormError("Select at least one subject to configure.");
      return;
    }
    if (items.some((item) => !item.question_deadline || !item.marks_deadline)) {
      setFormError("Set both a question deadline and a marks deadline for every selected subject.");
      return;
    }

    try {
      await configureMutation.mutateAsync(items);
      setRowConfigs({});
    } catch (mutationError) {
      setFormError(loginErrorMessage(mutationError));
    }
  }

  if (examQuery.isLoading) return <LoadingState label="Loading exam..." />;
  if (examQuery.isError) return <ErrorState message={loginErrorMessage(examQuery.error)} onRetry={() => examQuery.refetch()} />;
  if (!examQuery.data) return null;

  const exam = examQuery.data;
  const pendingCandidates = (candidatesQuery.data ?? []).filter((c) => !c.exam_subject_id);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{exam.name}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[exam.status]}>{EXAM_STATUS_LABELS[exam.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {exam.term ? `${exam.term} · ` : ""}
            {exam.start_date} – {exam.end_date} · Classes: {exam.classes.map((c) => c.class_name).join(", ")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configure subjects</CardTitle>
          <CardDescription>
            Select subjects to include in this exam and set marks and deadlines. Assigned teachers are notified
            automatically once configured.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {candidatesQuery.isLoading ? (
            <LoadingState label="Loading subjects..." />
          ) : pendingCandidates.length === 0 ? (
            <EmptyState message="All class-subjects for this exam's classes are already configured." />
          ) : (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2 font-medium text-muted-foreground">Class</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Subject</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Teacher</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Full marks</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Pass marks</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Question deadline</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Marks deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingCandidates.map((c) => {
                    const cfg = configFor(c.class_id, c.subject_id, c.default_full_marks);
                    return (
                      <tr key={rowKey(c.class_id, c.subject_id)}>
                        <td className="px-3 py-2">
                          <CheckboxUi
                            checked={cfg.selected}
                            disabled={!c.teacher_id}
                            onCheckedChange={(checked) =>
                              updateRow(c.class_id, c.subject_id, c.default_full_marks, { selected: checked === true })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">{c.class_name}</td>
                        <td className="px-3 py-2">
                          {c.subject_name} <span className="text-xs text-muted-foreground">({c.subject_code})</span>
                        </td>
                        <td className="px-3 py-2">
                          {c.teacher_name ?? <span className="text-destructive">No teacher assigned</span>}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={1}
                            className="w-20"
                            value={cfg.full_marks}
                            onChange={(e) =>
                              updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                full_marks: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-20"
                            value={cfg.pass_marks}
                            onChange={(e) =>
                              updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                pass_marks: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="datetime-local"
                            className="w-52"
                            value={cfg.question_deadline}
                            onChange={(e) =>
                              updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                question_deadline: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="datetime-local"
                            className="w-52"
                            value={cfg.marks_deadline}
                            onChange={(e) =>
                              updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                marks_deadline: e.target.value,
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
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          {pendingCandidates.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={handleConfigureSelected} disabled={configureMutation.isPending}>
                Configure selected & notify teachers
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured subjects</CardTitle>
          <CardDescription>Question submission status per subject.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {(exam.subjects ?? []).length === 0 ? (
            <EmptyState message="No subjects configured yet." />
          ) : (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Class</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Subject</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Teacher</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Question deadline</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {exam.subjects!.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2">{s.class_name}</td>
                      <td className="px-3 py-2">{s.subject_name}</td>
                      <td className="px-3 py-2">{s.teacher_name}</td>
                      <td className="px-3 py-2">{new Date(s.question_deadline).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {s.question_submitted_at ? (
                          <Badge variant="success">Submitted</Badge>
                        ) : s.is_overdue ? (
                          <Badge variant="destructive">Overdue</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!s.question_submitted_at && (
                          <ExtendDeadlineDialog
                            examSubjectId={s.id}
                            currentDeadline={s.question_deadline}
                            subjectLabel={`${s.subject_name} — ${s.class_name}`}
                            trigger={
                              <Button variant="outline" size="sm">
                                Extend deadline
                              </Button>
                            }
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
