"use client";

import { RefreshCw, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { loginErrorMessage } from "@/hooks/use-auth";
import {
  useDeleteSheetMutation,
  usePatchSheetMutation,
  useReprocessSheetMutation,
  useSheetQuery,
} from "@/hooks/use-omr";
import { useMarksRosterQuery } from "@/hooks/use-results";
import { ANSWER_OPTIONS, MATCH_STATUS_LABELS, type AnswerOption } from "@/lib/api/omr";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  correct: "bg-success/15 text-success",
  wrong: "bg-destructive/15 text-destructive",
  blank: "bg-warning/15 text-warning",
  multiple: "bg-muted text-muted-foreground",
  ambiguous: "bg-muted text-muted-foreground",
};

export function SheetDetailDialog({
  sheetId,
  batchId,
  examSubjectId,
  readOnly = false,
  onClose,
}: {
  sheetId: string | null;
  batchId: string;
  examSubjectId: string;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const sheetQuery = useSheetQuery(sheetId);
  const rosterQuery = useMarksRosterQuery(examSubjectId);
  const patchMutation = usePatchSheetMutation(batchId);
  const reprocessMutation = useReprocessSheetMutation(batchId);
  const deleteMutation = useDeleteSheetMutation(batchId);

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [studentId, setStudentId] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const sheet = sheetQuery.data;

  // Reset the edit buffer whenever a different sheet (or a newer version of the
  // same sheet) loads, so corrections never leak between sheets.
  const seed = sheet ? `${sheet.id}:${sheet.updated_at}` : null;
  if (seed && loadedId !== seed) {
    setLoadedId(seed);
    setOverrides({});
    setStudentId(sheet!.student_id ?? "");
    setNote("");
    setError(null);
  }

  const hasChanges =
    Object.keys(overrides).length > 0 ||
    (studentId && studentId !== (sheet?.student_id ?? "")) ||
    note.trim().length > 0;

  async function handleSave() {
    if (!sheet) return;
    setError(null);
    try {
      await patchMutation.mutateAsync({
        sheetId: sheet.id,
        payload: {
          ...(Object.keys(overrides).length ? { answer_overrides: overrides } : {}),
          ...(studentId && studentId !== (sheet.student_id ?? "") ? { student_id: studentId } : {}),
          ...(note.trim() ? { review_note: note.trim() } : {}),
        },
      });
      setOverrides({});
      setNote("");
    } catch (err) {
      setError(loginErrorMessage(err));
    }
  }

  async function handleReprocess(resetMatch: boolean) {
    if (!sheet) return;
    setError(null);
    try {
      await reprocessMutation.mutateAsync({ sheetId: sheet.id, resetMatch });
    } catch (err) {
      setError(loginErrorMessage(err));
    }
  }

  return (
    <Dialog open={Boolean(sheetId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review scanned sheet</DialogTitle>
          <DialogDescription>
            {sheet
              ? `${sheet.original_filename} · read via ${sheet.alignment_method ?? "unknown"} alignment`
              : "Loading the scanned sheet..."}
          </DialogDescription>
        </DialogHeader>

        {sheetQuery.isLoading ? (
          <LoadingState label="Loading sheet..." />
        ) : sheetQuery.isError ? (
          <ErrorState
            message={loginErrorMessage(sheetQuery.error)}
            onRetry={() => sheetQuery.refetch()}
          />
        ) : sheet ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            {/* --- Left: the scan itself and its identity ------------------- */}
            <div className="flex flex-col gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sheet.annotated_image_url ?? sheet.image_url}
                alt={`Scanned sheet ${sheet.original_filename}`}
                className="w-full rounded border border-border bg-muted object-contain"
              />

              <div className="flex flex-col gap-1 rounded border border-border bg-card p-3 text-sm">
                <Row label="Detected roll" value={sheet.detected_roll ?? "—"} />
                <Row label="Detected class" value={sheet.detected_class?.toString() ?? "—"} />
                <Row label="Set code" value={sheet.detected_set_code ?? "—"} />
                <Row label="Subject code" value={sheet.detected_subject_code ?? "—"} />
                <Row
                  label="Score"
                  value={sheet.marks_obtained !== null ? `${sheet.marks_obtained}` : "—"}
                />
                {sheet.match_status && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-muted-foreground">Match</span>
                    <Badge variant={sheet.match_status === "matched" || sheet.match_status === "manual" ? "success" : "warning"}>
                      {MATCH_STATUS_LABELS[sheet.match_status]}
                    </Badge>
                  </div>
                )}
              </div>

              {sheet.error_message && <ErrorState message={sheet.error_message} />}
              {sheet.review_note && (
                <div className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                  <span className="font-medium">Needs attention</span>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{sheet.review_note}</p>
                </div>
              )}

              {!readOnly && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="assign-student">Assign to student</Label>
                    <Select value={studentId} onValueChange={setStudentId}>
                      <SelectTrigger id="assign-student">
                        <SelectValue placeholder="Choose a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {(rosterQuery.data?.students ?? []).map((student) => (
                          <SelectItem key={student.student_id} value={student.student_id}>
                            {student.roll_number} · {student.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="review-note">Reviewer note</Label>
                    <Textarea
                      id="review-note"
                      rows={2}
                      value={note}
                      placeholder="Why this sheet was corrected"
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSave} disabled={!hasChanges || patchMutation.isPending}>
                      <Save className="size-4" aria-hidden="true" />
                      Save corrections
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReprocess(false)}
                      disabled={reprocessMutation.isPending}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      Re-read sheet
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline">
                          <Trash2 className="size-4" aria-hidden="true" />
                          Discard
                        </Button>
                      }
                      title="Discard this sheet?"
                      description="The scan and its stored images are removed from the batch. This cannot be undone."
                      confirmLabel="Discard sheet"
                      isPending={deleteMutation.isPending}
                      onConfirm={() =>
                        deleteMutation.mutate(sheet.id, { onSuccess: onClose })
                      }
                    />
                  </div>
                  {error && <ErrorState message={error} />}
                </div>
              )}
            </div>

            {/* --- Right: per-question breakdown ---------------------------- */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Answers</span>
              {sheet.answers ? (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(sheet.answers)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([question, answer]) => {
                      const detail = sheet.score_details?.[question];
                      const status = detail?.status ?? answer.status;
                      const chosen = overrides[question] ?? answer.answer;
                      return (
                        <div
                          key={question}
                          className={cn(
                            "flex items-center gap-2 rounded border border-border px-2 py-1.5 text-sm",
                            STATUS_TONE[status] ?? "bg-card"
                          )}
                        >
                          <span className="w-7 shrink-0 font-medium">{question}.</span>
                          <div className="flex flex-1 gap-1">
                            {ANSWER_OPTIONS.map((option) => {
                              const isChosen = chosen.toUpperCase() === option.toUpperCase();
                              const isCorrect =
                                detail?.correct?.toUpperCase() === option.toUpperCase();
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  disabled={readOnly}
                                  aria-pressed={isChosen}
                                  aria-label={`Question ${question}, set answer to ${option}`}
                                  onClick={() =>
                                    setOverrides((prev) => ({
                                      ...prev,
                                      [question]: option as AnswerOption,
                                    }))
                                  }
                                  className={cn(
                                    "flex-1 rounded px-1 py-0.5 text-xs font-medium transition-colors",
                                    isChosen
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-background/60 text-muted-foreground hover:bg-accent",
                                    isCorrect && !isChosen && "ring-1 ring-success",
                                    readOnly && "cursor-not-allowed"
                                  )}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                          <span className="w-14 shrink-0 text-right text-xs">
                            {overrides[question]
                              ? "edited"
                              : answer.confidence === "MANUAL"
                                ? "manual"
                                : answer.confidence.toLowerCase()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This sheet could not be read, so it has no answers to show.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
