"use client";

import { CircleAlert, Plus, ScanLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useBatchesQuery, useCreateBatchMutation, useDeleteBatchMutation, useEligibilityQueries } from "@/hooks/use-omr";
import { BATCH_STATUS_LABELS, type BatchStatus } from "@/lib/api/omr";
import { cn } from "@/lib/utils";

export interface ExamSubjectOption {
  id: string;
  label: string;
  description?: string;
}

const STATUS_VARIANT: Record<BatchStatus, "default" | "success" | "warning" | "destructive"> = {
  draft: "default",
  processing: "warning",
  ready: "success",
  applied: "success",
  failed: "destructive",
};

function CreateBatchDialog({ examSubjects }: { examSubjects: ExamSubjectOption[] }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateBatchMutation();
  const eligibility = useEligibilityQueries(examSubjects.map((s) => s.id));

  const rows = examSubjects.map((subject, index) => {
    const query = eligibility[index];
    return {
      subject,
      isLoading: query?.isPending ?? true,
      eligible: query?.data?.eligible ?? false,
      reason: query?.data?.reason ?? null,
      hasKeys: (query?.data?.answer_key_set_codes ?? []).length > 0,
      hasAppliedBatch: query?.data?.has_applied_batch ?? false,
      mcqFullMarks: query?.data?.mcq_full_marks ?? null,
    };
  });

  const selected = rows.find((row) => row.subject.id === selectedId);
  const canSubmit = Boolean(selected?.eligible && selected?.hasKeys && name.trim());

  async function handleCreate() {
    if (!selectedId) return;
    setError(null);
    try {
      await createMutation.mutateAsync({ examSubjectId: selectedId, name: name.trim() });
      setOpen(false);
      setSelectedId(null);
      setName("");
    } catch (err) {
      setError(loginErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          New scan batch
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a scan batch</DialogTitle>
          <DialogDescription>
            Only MCQ-only exam subjects can be scanned. A subject that mixes MCQ with written or
            practical marks has nowhere to record an MCQ subtotal separately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Exam subject</Label>
            {examSubjects.length === 0 ? (
              <EmptyState message="No exam subjects available to scan." />
            ) : (
              <TooltipProvider>
                <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                  {rows.map((row) => {
                    const blocked = !row.eligible || !row.hasKeys;
                    const blockedReason = !row.eligible
                      ? row.reason ?? "This subject cannot be scanned."
                      : "Define an answer key for this subject before scanning.";
                    const isSelected = row.subject.id === selectedId;

                    const button = (
                      <button
                        type="button"
                        disabled={row.isLoading || blocked}
                        onClick={() => setSelectedId(row.subject.id)}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 rounded border px-3 py-2 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:bg-accent",
                          blocked && "cursor-not-allowed opacity-60 hover:bg-card"
                        )}
                      >
                        <span className="flex w-full items-center justify-between gap-2 text-sm font-medium text-foreground">
                          {row.subject.label}
                          {row.isLoading ? (
                            <Badge variant="default">Checking…</Badge>
                          ) : blocked ? (
                            <Badge variant="warning">
                              <CircleAlert className="size-3" aria-hidden="true" />
                              Not scannable
                            </Badge>
                          ) : (
                            <Badge variant="success">{row.mcqFullMarks} marks</Badge>
                          )}
                        </span>
                        {row.subject.description && (
                          <span className="text-xs text-muted-foreground">
                            {row.subject.description}
                          </span>
                        )}
                        {row.hasAppliedBatch && (
                          <span className="text-xs text-warning">
                            A batch has already been applied for this subject.
                          </span>
                        )}
                      </button>
                    );

                    return (
                      <div key={row.subject.id}>
                        {blocked && !row.isLoading ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block">{button}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{blockedReason}</TooltipContent>
                          </Tooltip>
                        ) : (
                          button
                        )}
                      </div>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input
              id="batch-name"
              value={name}
              placeholder="e.g. Section A morning scan"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {error && <ErrorState message={error} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit || createMutation.isPending}>
            <ScanLine className="size-4" aria-hidden="true" />
            Create batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BatchList({
  examSubjects,
  basePath,
}: {
  examSubjects: ExamSubjectOption[];
  basePath: string;
}) {
  const batchesQuery = useBatchesQuery();
  const deleteMutation = useDeleteBatchMutation();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">OMR scanning</h1>
          <p className="text-sm text-muted-foreground">
            Scan MCQ answer sheets, review what the reader found, then apply the scores to the
            marks roster.
          </p>
        </div>
        <CreateBatchDialog examSubjects={examSubjects} />
      </div>

      {batchesQuery.isLoading ? (
        <LoadingState label="Loading scan batches..." />
      ) : batchesQuery.isError ? (
        <ErrorState
          message={loginErrorMessage(batchesQuery.error)}
          onRetry={() => batchesQuery.refetch()}
        />
      ) : (batchesQuery.data ?? []).length === 0 ? (
        <EmptyState message="No scan batches yet. Create one to start uploading answer sheets." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batchesQuery.data!.map((batch) => (
            <Card key={batch.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{batch.name}</CardTitle>
                  <Badge variant={STATUS_VARIANT[batch.status]}>
                    {BATCH_STATUS_LABELS[batch.status]}
                  </Badge>
                </div>
                <CardDescription>
                  {batch.sheet_count} sheet{batch.sheet_count === 1 ? "" : "s"} ·{" "}
                  {batch.matched_count} matched
                  {batch.failed_count > 0 && ` · ${batch.failed_count} failed`}
                </CardDescription>
                <p className="text-sm text-muted-foreground">
                  Out of {batch.mcq_full_marks} marks · created{" "}
                  {new Date(batch.created_at).toLocaleDateString()}
                </p>
              </CardHeader>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                <Button asChild size="sm">
                  <Link href={`${basePath}/${batch.id}`}>
                    <ScanLine className="size-4" aria-hidden="true" />
                    {batch.status === "applied" ? "View batch" : "Open batch"}
                  </Link>
                </Button>
                {batch.status !== "applied" && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm">
                        <Trash2 className="size-4" aria-hidden="true" />
                        Delete
                      </Button>
                    }
                    title="Delete this batch?"
                    description="Every scanned sheet in it, and their stored images, will be removed. This cannot be undone."
                    confirmLabel="Delete batch"
                    isPending={deleteMutation.isPending}
                    onConfirm={() => deleteMutation.mutate(batch.id)}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
