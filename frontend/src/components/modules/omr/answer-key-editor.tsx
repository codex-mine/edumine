"use client";

import { ClipboardPaste, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { loginErrorMessage } from "@/hooks/use-auth";
import {
  useAnswerKeysQuery,
  useDeleteAnswerKeyMutation,
  useSaveAnswerKeyMutation,
} from "@/hooks/use-omr";
import { ANSWER_OPTIONS, SET_CODES, answerKeyOption, type AnswerOption } from "@/lib/api/omr";
import { cn } from "@/lib/utils";

const DEFAULT_QUESTION_COUNT = 40;

/** Parses "1:Ka, 2:Kha" or "1 Ka\n2 Kha" into a question -> option map. */
function parseBulkAnswers(raw: string): { answers: Record<string, string>; errors: string[] } {
  const answers: Record<string, string> = {};
  const errors: string[] = [];

  for (const chunk of raw.split(/[,\n;]+/)) {
    const text = chunk.trim();
    if (!text) continue;
    const match = text.match(/^(\d+)\s*[:.\-=\s]\s*([A-Za-z]+)$/);
    if (!match) {
      errors.push(text);
      continue;
    }
    const [, question, option] = match;
    const normalized = ANSWER_OPTIONS.find((o) => o.toLowerCase() === option.toLowerCase());
    if (!normalized) {
      errors.push(text);
      continue;
    }
    answers[question] = normalized;
  }
  return { answers, errors };
}

export function AnswerKeyEditor({ examSubjectId }: { examSubjectId: string }) {
  const keysQuery = useAnswerKeysQuery(examSubjectId);
  const saveMutation = useSaveAnswerKeyMutation(examSubjectId);
  const deleteMutation = useDeleteAnswerKeyMutation(examSubjectId);

  const [activeSetCode, setActiveSetCode] = useState<string>(SET_CODES[0]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(DEFAULT_QUESTION_COUNT);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const keys = keysQuery.data ?? [];
  const existing = keys.find((key) => key.set_code === activeSetCode);

  // Seed the editor from the stored key once per set code, during render, so a
  // background refetch never clobbers in-progress edits (same pattern as the
  // marks entry workspace).
  const seedKey = `${examSubjectId}:${activeSetCode}:${existing?.updated_at ?? "new"}`;
  if (keysQuery.data && loadedFor !== seedKey) {
    setLoadedFor(seedKey);
    setTotalQuestions(existing?.total_questions ?? DEFAULT_QUESTION_COUNT);
    setAnswers(
      existing
        ? Object.fromEntries(
            Object.entries(existing.answers).map(([q, entry]) => [q, answerKeyOption(entry)])
          )
        : {}
    );
    setSaveError(null);
    setSaveSuccess(false);
  }

  const questionNumbers = Array.from({ length: totalQuestions }, (_, i) => String(i + 1));
  const answeredCount = questionNumbers.filter((q) => answers[q]).length;
  const isComplete = answeredCount === totalQuestions;

  function setOption(question: string, option: AnswerOption) {
    setAnswers((prev) => ({ ...prev, [question]: option }));
    setSaveSuccess(false);
  }

  function applyBulk() {
    const { answers: parsed, errors } = parseBulkAnswers(bulkText);
    setBulkError(
      errors.length
        ? `Could not read ${errors.length} entr${errors.length === 1 ? "y" : "ies"}: ${errors.slice(0, 3).join(", ")}`
        : null
    );
    if (Object.keys(parsed).length) {
      setAnswers((prev) => ({ ...prev, ...parsed }));
      setBulkText("");
      setSaveSuccess(false);
    }
  }

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveMutation.mutateAsync({
        setCode: activeSetCode,
        payload: {
          total_questions: totalQuestions,
          answers: Object.fromEntries(questionNumbers.map((q) => [q, answers[q]])),
        },
      });
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(loginErrorMessage(error));
    }
  }

  if (keysQuery.isLoading) return <LoadingState label="Loading answer keys..." />;
  if (keysQuery.isError) {
    return (
      <ErrorState message={loginErrorMessage(keysQuery.error)} onRetry={() => keysQuery.refetch()} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Answer keys</CardTitle>
          <CardDescription>
            One key per set code, so a single exam can be sat with shuffled question orders. A
            scanned sheet is scored against the key matching the set code it was marked with.
          </CardDescription>
        </CardHeader>

        <div className="flex flex-wrap gap-2 px-4 pb-4" role="tablist" aria-label="Set code">
          {SET_CODES.map((setCode) => {
            const defined = keys.some((key) => key.set_code === setCode);
            const isActive = setCode === activeSetCode;
            return (
              <button
                key={setCode}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSetCode(setCode)}
                className={cn(
                  "flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {setCode}
                {defined && (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isActive ? "bg-primary-foreground" : "bg-success"
                    )}
                    aria-label="Key defined"
                  />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Set {activeSetCode}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isComplete ? "success" : "warning"}>
                {answeredCount} of {totalQuestions} answered
              </Badge>
              {existing && (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete key
                    </Button>
                  }
                  title={`Delete the set ${activeSetCode} key?`}
                  description="Sheets marked with this set code will no longer be scored until a new key is defined."
                  confirmLabel="Delete key"
                  isPending={deleteMutation.isPending}
                  onConfirm={() => deleteMutation.mutate(existing.id)}
                />
              )}
            </div>
          </div>
          <CardDescription>
            {existing
              ? `Last updated ${new Date(existing.updated_at).toLocaleString()}`
              : "No key defined for this set code yet."}
          </CardDescription>
        </CardHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="total-questions">Number of questions</Label>
              <Input
                id="total-questions"
                type="number"
                min={1}
                max={200}
                value={totalQuestions}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next >= 1 && next <= 200) setTotalQuestions(next);
                }}
                className="w-32"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-paste">Paste a key</Label>
            <Textarea
              id="bulk-paste"
              rows={2}
              placeholder="1:Ka, 2:Kha, 3:Ga, 4:Gha ..."
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={applyBulk} disabled={!bulkText.trim()}>
                <ClipboardPaste className="size-4" aria-hidden="true" />
                Apply paste
              </Button>
              {bulkError && <span className="text-sm text-destructive">{bulkError}</span>}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {questionNumbers.map((question) => (
              <div
                key={question}
                className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5"
              >
                <span className="w-7 shrink-0 text-sm font-medium text-muted-foreground">
                  {question}.
                </span>
                <div className="flex flex-1 gap-1">
                  {ANSWER_OPTIONS.map((option) => {
                    const isSelected = answers[question] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`Question ${question}, option ${option}`}
                        onClick={() => setOption(question, option)}
                        className={cn(
                          "flex-1 rounded px-1.5 py-1 text-xs font-medium transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {saveError && <ErrorState message={saveError} />}
          {saveSuccess && (
            <p className="text-sm text-success">Answer key saved for set {activeSetCode}.</p>
          )}

          <div className="flex items-center gap-2">
            <ConfirmDialog
              trigger={
                <Button disabled={!isComplete || saveMutation.isPending}>
                  <Save className="size-4" aria-hidden="true" />
                  {existing ? "Replace key" : "Save key"}
                </Button>
              }
              title={existing ? `Replace the set ${activeSetCode} key?` : `Save the set ${activeSetCode} key?`}
              description={
                existing
                  ? "The current key will be overwritten. Sheets already scanned keep their stored answers but are not rescored automatically."
                  : `This key will be used to score every sheet marked with set code ${activeSetCode}.`
              }
              confirmLabel={existing ? "Replace" : "Save"}
              destructive={Boolean(existing)}
              isPending={saveMutation.isPending}
              onConfirm={handleSave}
            />
            {!isComplete && (
              <span className="text-sm text-muted-foreground">
                Answer every question before saving.
              </span>
            )}
          </div>
        </div>
      </Card>

      {keys.length === 0 && (
        <EmptyState message="No answer keys defined yet — start with the set code printed on your sheets." />
      )}
    </div>
  );
}
