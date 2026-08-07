"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, FileText, Pencil, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { QuestionEditor } from "@/components/modules/exams/question-editor";
import { loginErrorMessage } from "@/hooks/use-auth";
import {
  useApproveQuestionsMutation,
  useRequestQuestionRevisionMutation,
  useSetQuestionsAsAdminMutation,
} from "@/hooks/use-exams";
import {
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_VARIANT,
  QUESTION_TYPE_LABELS,
  type ExamSubject,
  type QuestionItem,
} from "@/lib/api/exams";

type Mode = "preview" | "revision" | "edit";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function QuestionReviewDialog({
  examSubject,
  open,
  onOpenChange,
}: {
  examSubject: ExamSubject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("preview");
  const [note, setNote] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const approveMutation = useApproveQuestionsMutation();
  const revisionMutation = useRequestQuestionRevisionMutation();
  const saveMutation = useSetQuestionsAsAdminMutation();
  const isPending = approveMutation.isPending || revisionMutation.isPending || saveMutation.isPending;

  // Reset per record rather than in an effect, so reopening on a different
  // subject never shows the previous one's draft or error.
  if (examSubject && examSubject.id !== loadedId) {
    setLoadedId(examSubject.id);
    setQuestions(examSubject.questions ?? []);
    setMode("preview");
    setNote("");
    setError(null);
  }

  if (!examSubject) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Question review</DialogTitle>
            <DialogDescription>Select a subject to review.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const hasQuestions = (examSubject.questions ?? []).length > 0;
  const totalMarks = (examSubject.questions ?? []).reduce((sum, q) => sum + q.marks, 0);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onOpenChange(false);
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {examSubject.subject_name} — {examSubject.class_name}
            <Badge variant={QUESTION_STATUS_VARIANT[examSubject.question_status]}>
              {QUESTION_STATUS_LABELS[examSubject.question_status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {examSubject.exam_name} · submitted by {examSubject.teacher_name}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-border p-3 text-sm">
          <DetailRow label="Full marks" value={examSubject.full_marks} />
          <DetailRow label="Pass marks" value={examSubject.pass_marks} />
          <DetailRow
            label="Submitted"
            value={
              examSubject.question_submitted_at
                ? new Date(examSubject.question_submitted_at).toLocaleString()
                : "Not submitted"
            }
          />
          {examSubject.question_reviewed_at && (
            <DetailRow
              label="Last reviewed"
              value={`${new Date(examSubject.question_reviewed_at).toLocaleString()}${
                examSubject.question_reviewer_name ? ` by ${examSubject.question_reviewer_name}` : ""
              }`}
            />
          )}
          {examSubject.sections.length > 0 && (
            <DetailRow
              label="Sections"
              value={examSubject.sections.map((s) => `${s.name} (${s.full_marks})`).join(", ")}
            />
          )}
        </div>

        {examSubject.question_review_note && mode === "preview" && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">Revision requested</p>
            <p className="mt-1 text-foreground">{examSubject.question_review_note}</p>
          </div>
        )}

        {mode === "preview" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">
              Questions {hasQuestions && `(${examSubject.questions?.length} · ${totalMarks} marks)`}
            </p>
            {!hasQuestions ? (
              <EmptyState message="No questions submitted yet. Use “Write questions” to author them directly." />
            ) : (
              <ol className="flex flex-col gap-3">
                {(examSubject.questions ?? []).map((question, index) => (
                  <li key={index} className="rounded border border-border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-foreground">
                        {index + 1}. {question.question_text}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{question.marks} marks</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="muted">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                      {question.section && <Badge variant="info">{question.section}</Badge>}
                    </div>
                    {question.options && question.options.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-0.5 pl-4 text-muted-foreground">
                        {question.options.map((option, optionIndex) => (
                          <li key={optionIndex}>
                            ({String.fromCharCode(97 + optionIndex)}) {option}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {mode === "revision" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revision_note">What needs to change?</Label>
            <Textarea
              id="revision_note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Question 3 is outside the syllabus — please replace it."
            />
            <p className="text-xs text-muted-foreground">
              The teacher is emailed this note and can edit and resubmit, even if the deadline has passed.
            </p>
          </div>
        )}

        {mode === "edit" && (
          <QuestionEditor
            questions={questions}
            onChange={setQuestions}
            fullMarks={examSubject.full_marks}
            sections={examSubject.sections}
          />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex-wrap gap-2">
          {mode === "preview" && (
            <>
              {examSubject.question_status === "approved" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/admin/exams/paper/${examSubject.id}`)}
                >
                  <FileText className="size-4" /> Question paper
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setMode("edit")}>
                <Pencil className="size-4" /> {hasQuestions ? "Edit questions" : "Write questions"}
              </Button>
              {hasQuestions && examSubject.question_status !== "draft" && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setMode("revision")}
                >
                  <Undo2 className="size-4" /> Request revision
                </Button>
              )}
              {hasQuestions && examSubject.question_status !== "approved" && (
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => approveMutation.mutateAsync(examSubject.id))}
                >
                  <Check className="size-4" /> Approve
                </Button>
              )}
            </>
          )}

          {mode === "revision" && (
            <>
              <Button type="button" variant="outline" onClick={() => setMode("preview")} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending || note.trim().length === 0}
                onClick={() =>
                  run(() => revisionMutation.mutateAsync({ examSubjectId: examSubject.id, note: note.trim() }))
                }
              >
                Send back to teacher
              </Button>
            </>
          )}

          {mode === "edit" && (
            <>
              <Button type="button" variant="outline" onClick={() => setMode("preview")} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isPending || questions.length === 0}
                onClick={() =>
                  run(() => saveMutation.mutateAsync({ examSubjectId: examSubject.id, questions }))
                }
              >
                Save &amp; approve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
