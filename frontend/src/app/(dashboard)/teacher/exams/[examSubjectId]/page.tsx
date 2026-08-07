"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { QuestionEditor } from "@/components/modules/exams/question-editor";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useDraftQuestionsMutation, useMySubmissionsQuery, useSubmitQuestionsMutation } from "@/hooks/use-exams";
import {
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_VARIANT,
  type QuestionItem,
} from "@/lib/api/exams";

export default function ExamSubjectWorkspacePage() {
  const params = useParams<{ examSubjectId: string }>();
  const router = useRouter();
  const examSubjectId = params.examSubjectId;

  const submissionsQuery = useMySubmissionsQuery();
  const submitMutation = useSubmitQuestionsMutation();
  const draftMutation = useDraftQuestionsMutation();

  const item = (submissionsQuery.data ?? []).find((s) => s.id === examSubjectId);

  const [loadedItemId, setLoadedItemId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [topics, setTopics] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [questionType, setQuestionType] = useState<"mcq" | "short" | "long" | "mixed">("mixed");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftApplied, setDraftApplied] = useState(false);

  // Seed the editable draft from the loaded submission exactly once per item —
  // set during render (not an effect) per React's "adjusting state on prop
  // change" pattern, so a background refetch never clobbers in-progress edits.
  if (item && item.id !== loadedItemId) {
    setLoadedItemId(item.id);
    setQuestions(item.questions ?? []);
  }

  async function handleGenerateDraft() {
    setDraftError(null);
    setDraftApplied(false);
    try {
      const result = await draftMutation.mutateAsync({
        examSubjectId,
        payload: { topics, question_count: questionCount, question_type: questionType },
      });
      // AI output is never auto-submitted — it only replaces the in-progress
      // draft in this editor, which the teacher must still review, edit, and
      // explicitly submit below.
      setQuestions(result.questions);
      setDraftApplied(true);
    } catch (mutationError) {
      setDraftError(loginErrorMessage(mutationError));
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await submitMutation.mutateAsync({ examSubjectId, questions });
      setSubmitSuccess(true);
    } catch (mutationError) {
      setSubmitError(loginErrorMessage(mutationError));
    }
  }

  if (submissionsQuery.isLoading) return <LoadingState label="Loading assignment..." />;
  if (submissionsQuery.isError) {
    return <ErrorState message={loginErrorMessage(submissionsQuery.error)} onRetry={() => submissionsQuery.refetch()} />;
  }
  if (!item) return <EmptyState message="This exam question assignment was not found." />;

  const totalMarks = questions.reduce((sum, q) => sum + (Number.isFinite(q.marks) ? q.marks : 0), 0);
  const isApproved = item.question_status === "approved";
  const needsRevision = item.question_status === "revision_requested";
  // A revision request reopens the paper regardless of the original deadline —
  // the server applies the same rule, so the button matches what it will accept.
  const deadlineBlocks = item.is_overdue && !needsRevision;
  const canSubmit =
    questions.length > 0 && totalMarks === item.full_marks && !deadlineBlocks && !isApproved;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/teacher/exams")}>
          ← Back to assignments
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {item.subject_name} — {item.class_name}
          </h1>
          {item.question_status !== "draft" ? (
            <Badge variant={QUESTION_STATUS_VARIANT[item.question_status]}>
              {QUESTION_STATUS_LABELS[item.question_status]}
            </Badge>
          ) : item.is_overdue ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : (
            <Badge variant="warning">Pending</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {item.exam_name} · Full marks {item.full_marks} · Deadline {new Date(item.question_deadline).toLocaleString()}
        </p>
      </div>

      {item.is_overdue && !item.question_submitted_at && !needsRevision && (
        <ErrorState message="The submission deadline has passed. Request an extension from your assignments list before you can submit." />
      )}

      {needsRevision && item.question_review_note && (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">
            Changes requested
            {item.question_reviewer_name ? ` by ${item.question_reviewer_name}` : ""}
          </p>
          <p className="mt-1 text-foreground">{item.question_review_note}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Edit the questions below and resubmit — the original deadline no longer blocks you.
          </p>
        </div>
      )}

      {isApproved && (
        <div className="rounded border border-success/40 bg-success/5 p-3 text-sm">
          <p className="font-medium text-success">Approved</p>
          <p className="mt-1 text-muted-foreground">
            This paper is locked. Ask an admin to request a revision if something needs to change.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> AI draft assist
          </CardTitle>
          <CardDescription>
            Describe the topics to cover and let the AI draft a starting set of questions. You must review, edit,
            and explicitly submit — nothing is ever submitted automatically.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft_topics">Topics / syllabus notes</Label>
            <Textarea
              id="draft_topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="e.g. Photosynthesis, cell structure, and the process of respiration"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft_count">Number of questions</Label>
              <Input
                id="draft_count"
                type="number"
                min={1}
                max={50}
                className="w-32"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value) || 1)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft_type">Question type</Label>
              <Select value={questionType} onValueChange={(v) => setQuestionType(v as typeof questionType)}>
                <SelectTrigger id="draft_type" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="mcq">Multiple choice</SelectItem>
                  <SelectItem value="short">Short answer</SelectItem>
                  <SelectItem value="long">Long answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {draftError && <p className="text-sm text-destructive">{draftError}</p>}
          {draftApplied && (
            <p className="text-sm text-info">
              Draft loaded into the editor below — review and edit before submitting.
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateDraft}
              disabled={draftMutation.isPending || !topics.trim() || isApproved}
            >
              <Sparkles className="size-4" /> {draftMutation.isPending ? "Drafting..." : "Generate draft"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>Review and edit the questions before submitting.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <QuestionEditor
            questions={questions}
            onChange={setQuestions}
            fullMarks={item.full_marks}
            sections={item.sections}
          />

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          {submitSuccess && <p className="text-sm text-success">Questions submitted successfully.</p>}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!canSubmit || submitMutation.isPending}>
              {needsRevision
                ? "Resubmit for approval"
                : item.question_submitted_at
                  ? "Re-submit questions"
                  : "Submit questions"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
