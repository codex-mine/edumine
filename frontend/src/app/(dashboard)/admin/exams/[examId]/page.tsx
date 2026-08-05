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
import { ExamSectionsDialog } from "@/components/modules/exams/exam-sections-dialog";
import { ExtendDeadlineDialog } from "@/components/modules/exams/extend-deadline-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useCandidateSubjectsQuery, useConfigureExamSubjectsMutation, useExamQuery } from "@/hooks/use-exams";
import {
  EXAM_STATUS_LABELS,
  type CandidateSubject,
  type ExamStatus,
  type ExamSubjectSectionInput,
} from "@/lib/api/exams";

const MAX_SUBJECT_MARKS = 100;

function clampMarks(value: number, max: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.round(value), max);
}

// Open the native date/time picker wherever the field is clicked, not only on
// the small calendar glyph.
function openDatePicker(event: React.MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker();
  } catch {
    // showPicker throws when unsupported or not user-activated; the field stays typable.
  }
}

const STATUS_BADGE_VARIANT: Record<ExamStatus, "muted" | "warning" | "success" | "info"> = {
  draft: "muted",
  question_pending: "warning",
  ready: "success",
  results_pending: "info",
  published: "info",
};

type WindowField = "question_window_opens_at" | "question_deadline" | "marks_window_opens_at" | "marks_deadline";

const BULK_WINDOW_FIELDS: { key: WindowField; label: string }[] = [
  { key: "question_window_opens_at", label: "Question window opens" },
  { key: "question_deadline", label: "Question deadline (closes)" },
  { key: "marks_window_opens_at", label: "Marks window opens" },
  { key: "marks_deadline", label: "Marks deadline (closes)" },
];

type BulkWindows = Record<WindowField, string>;

const EMPTY_BULK_WINDOWS: BulkWindows = {
  question_window_opens_at: "",
  question_deadline: "",
  marks_window_opens_at: "",
  marks_deadline: "",
};

interface RowConfig {
  selected: boolean;
  full_marks: number;
  pass_marks: number;
  question_window_opens_at: string;
  question_deadline: string;
  marks_window_opens_at: string;
  marks_deadline: string;
  sections: ExamSubjectSectionInput[];
}

function defaultRowConfig(defaultFullMarks: number): RowConfig {
  const fullMarks = clampMarks(defaultFullMarks, MAX_SUBJECT_MARKS);
  return {
    selected: false,
    full_marks: fullMarks,
    pass_marks: Math.round(fullMarks * 0.33),
    question_window_opens_at: "",
    question_deadline: "",
    marks_window_opens_at: "",
    marks_deadline: "",
    sections: [],
  };
}

export default function ExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;

  const examQuery = useExamQuery(examId);
  const candidatesQuery = useCandidateSubjectsQuery(examId);
  const configureMutation = useConfigureExamSubjectsMutation(examId);

  const [rowConfigs, setRowConfigs] = useState<Record<string, RowConfig>>({});
  const [bulkWindows, setBulkWindows] = useState<BulkWindows>(EMPTY_BULK_WINDOWS);
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

  // Rows without an assigned teacher can never be configured, so bulk actions skip them.
  function selectableCandidates() {
    return (candidatesQuery.data ?? []).filter((c) => !c.exam_subject_id && c.teacher_id);
  }

  function selectedCandidates() {
    return selectableCandidates().filter((c) => configFor(c.class_id, c.subject_id, c.default_full_marks).selected);
  }

  function patchRows(candidates: CandidateSubject[], patchFor: (key: string) => Partial<RowConfig>) {
    setRowConfigs((prev) => {
      const next = { ...prev };
      for (const c of candidates) {
        const key = rowKey(c.class_id, c.subject_id);
        next[key] = { ...(next[key] ?? defaultRowConfig(c.default_full_marks)), ...patchFor(key) };
      }
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    setFormError(null);
    patchRows(selectableCandidates(), () => ({ selected: checked }));
  }

  // Copies whichever bulk fields have been filled in onto every selected subject.
  // Blank bulk fields are left untouched so per-subject edits survive.
  function handleApplyBulkWindows() {
    const targets = selectedCandidates();
    if (targets.length === 0) {
      setFormError("Select at least one subject before applying the shared windows.");
      return;
    }
    const patch: Partial<RowConfig> = {};
    for (const field of BULK_WINDOW_FIELDS) {
      if (bulkWindows[field.key]) patch[field.key] = bulkWindows[field.key];
    }
    if (Object.keys(patch).length === 0) {
      setFormError("Set at least one shared date before applying.");
      return;
    }
    setFormError(null);
    patchRows(targets, () => patch);
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
          question_window_opens_at: cfg.question_window_opens_at
            ? new Date(cfg.question_window_opens_at).toISOString()
            : null,
          question_deadline: cfg.question_deadline ? new Date(cfg.question_deadline).toISOString() : "",
          marks_window_opens_at: cfg.marks_window_opens_at ? new Date(cfg.marks_window_opens_at).toISOString() : null,
          marks_deadline: cfg.marks_deadline ? new Date(cfg.marks_deadline).toISOString() : "",
          sections: cfg.sections,
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
    if (items.some((item) => item.full_marks < 1 || item.full_marks > MAX_SUBJECT_MARKS)) {
      setFormError(`Full marks must be between 1 and ${MAX_SUBJECT_MARKS} for every selected subject.`);
      return;
    }
    if (items.some((item) => item.pass_marks > item.full_marks)) {
      setFormError("Pass marks cannot be greater than full marks.");
      return;
    }
    const unbalanced = items.some(
      (item) => item.sections.length > 0 && item.sections.reduce((sum, s) => sum + s.full_marks, 0) !== item.full_marks
    );
    if (unbalanced) {
      setFormError("Section marks must sum to exactly the full marks for every subject with sections configured.");
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
  const selectableCount = selectableCandidates().length;
  const selectedCount = selectedCandidates().length;
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;

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
            <>
            <div className="flex flex-col gap-3 rounded border border-border bg-muted/40 p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Set the same windows for many subjects</span>
                <span className="text-xs text-muted-foreground">
                  Tick the subjects (or use select all in the table header), fill in the shared dates, then apply. Any
                  subject can still be adjusted individually afterwards.
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {BULK_WINDOW_FIELDS.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1">
                    <label htmlFor={`bulk_${field.key}`} className="text-xs text-muted-foreground">
                      {field.label}
                    </label>
                    <Input
                      id={`bulk_${field.key}`}
                      type="datetime-local"
                      className="w-[240px] cursor-pointer"
                      value={bulkWindows[field.key]}
                      onClick={openDatePicker}
                      onChange={(e) => setBulkWindows((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={handleApplyBulkWindows}>
                    Apply to selected ({selectedCount})
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setBulkWindows(EMPTY_BULK_WINDOWS)}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2">
                      <div className="flex flex-col items-center gap-1">
                        <CheckboxUi
                          aria-label="Select all subjects"
                          checked={allSelected}
                          disabled={selectableCount === 0}
                          onCheckedChange={(checked) => handleSelectAll(checked === true)}
                        />
                        <span className="text-[10px] font-medium text-muted-foreground">All</span>
                      </div>
                    </th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Class</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Subject</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Teacher</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Full marks</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Pass marks</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Sections</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Question submission window</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Marks submission window</th>
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
                            max={MAX_SUBJECT_MARKS}
                            className="w-[100px]"
                            value={cfg.full_marks}
                            onChange={(e) => {
                              const fullMarks = clampMarks(Number(e.target.value), MAX_SUBJECT_MARKS);
                              updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                full_marks: fullMarks,
                                pass_marks: Math.min(cfg.pass_marks, fullMarks),
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={cfg.full_marks}
                            className="w-[100px]"
                            value={cfg.pass_marks}
                            onChange={(e) =>
                              updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                pass_marks: clampMarks(Number(e.target.value), cfg.full_marks),
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <ExamSectionsDialog
                            fullMarks={cfg.full_marks}
                            sections={cfg.sections}
                            onChange={(sections) => updateRow(c.class_id, c.subject_id, c.default_full_marks, { sections })}
                            trigger={
                              <Button type="button" variant="outline" size="sm">
                                {cfg.sections.length > 0 ? `${cfg.sections.length} section(s)` : "Configure"}
                              </Button>
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Opens</label>
                            <Input
                              type="datetime-local"
                              className="w-[240px] cursor-pointer"
                              value={cfg.question_window_opens_at}
                              onClick={openDatePicker}
                              onChange={(e) =>
                                updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                  question_window_opens_at: e.target.value,
                                })
                              }
                            />
                            <label className="text-xs text-muted-foreground">Closes (deadline)</label>
                            <Input
                              type="datetime-local"
                              className="w-[240px] cursor-pointer"
                              value={cfg.question_deadline}
                              onClick={openDatePicker}
                              onChange={(e) =>
                                updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                  question_deadline: e.target.value,
                                })
                              }
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Opens</label>
                            <Input
                              type="datetime-local"
                              className="w-[240px] cursor-pointer"
                              value={cfg.marks_window_opens_at}
                              onClick={openDatePicker}
                              onChange={(e) =>
                                updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                  marks_window_opens_at: e.target.value,
                                })
                              }
                            />
                            <label className="text-xs text-muted-foreground">Closes (deadline)</label>
                            <Input
                              type="datetime-local"
                              className="w-[240px] cursor-pointer"
                              value={cfg.marks_deadline}
                              onClick={openDatePicker}
                              onChange={(e) =>
                                updateRow(c.class_id, c.subject_id, c.default_full_marks, {
                                  marks_deadline: e.target.value,
                                })
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
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
                    <th className="px-3 py-2 font-medium text-muted-foreground">Marks</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Question submission window</th>
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
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span>
                            {s.full_marks} full &middot; {s.pass_marks} pass
                          </span>
                          {s.sections.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {s.sections.map((section) => `${section.name} (${section.full_marks})`).join(", ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          {s.question_window_opens_at && (
                            <span className="text-xs text-muted-foreground">
                              Opens {new Date(s.question_window_opens_at).toLocaleString()}
                            </span>
                          )}
                          <span>Closes {new Date(s.question_deadline).toLocaleString()}</span>
                        </div>
                      </td>
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
