"use client";

import { CheckCircle2, CircleAlert, Send } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useApplyBatchMutation, useSheetsQuery } from "@/hooks/use-omr";
import { useMarksRosterQuery } from "@/hooks/use-results";
import type { ApplyBatchResult, OmrBatch } from "@/lib/api/omr";

export function ApplyToRosterDialog({
  batch,
  examSubjectId,
}: {
  batch: OmrBatch;
  examSubjectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyBatchResult | null>(null);

  const sheetsQuery = useSheetsQuery(batch.id);
  const rosterQuery = useMarksRosterQuery(examSubjectId);
  const applyMutation = useApplyBatchMutation(batch.id);

  const sheets = sheetsQuery.data ?? [];
  const matched = sheets.filter(
    (sheet) => sheet.match_status === "matched" || sheet.match_status === "manual"
  );
  const needsReview = sheets.filter((sheet) => sheet.status === "needs_review");
  const matchedStudentIds = new Set(matched.map((sheet) => sheet.student_id));
  const unscanned = (rosterQuery.data?.students ?? []).filter(
    (student) => !matchedStudentIds.has(student.student_id)
  );

  const isReady = batch.status === "ready";
  const isApplied = batch.status === "applied";

  async function handleApply() {
    setError(null);
    try {
      setResult(await applyMutation.mutateAsync());
    } catch (err) {
      setError(loginErrorMessage(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={isApplied}>
          <Send className="size-4" aria-hidden="true" />
          {isApplied ? "Applied to roster" : "Apply to marks roster"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply scanned results</DialogTitle>
          <DialogDescription>
            Scores are written to the marks roster for this subject. You still submit the marks
            yourself afterwards — nothing is finalised or published here.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded border border-success/40 bg-success/10 p-3 text-sm">
              <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
              <span className="text-foreground">
                {result.applied_count} result{result.applied_count === 1 ? "" : "s"} written to the
                marks roster.
              </span>
            </div>
            {result.unscanned.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  {result.unscanned.length} student
                  {result.unscanned.length === 1 ? " was" : "s were"} not scanned
                </span>
                <p className="text-xs text-muted-foreground">
                  These were left untouched — enter their marks by hand, or mark them absent.
                </p>
                <ul className="flex flex-col gap-1">
                  {result.unscanned.map((student) => (
                    <li key={student.student_id} className="text-sm text-muted-foreground">
                      {student.roll_number} · {student.full_name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Matched" value={matched.length} tone="success" />
              <Stat label="Needs review" value={needsReview.length} tone="warning" />
              <Stat label="Not scanned" value={unscanned.length} tone="default" />
            </div>

            {!isReady && (
              <div className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 p-3 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span className="text-foreground">
                  Every sheet must be read and its review resolved before this batch can be
                  applied.
                </span>
              </div>
            )}

            {unscanned.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Students with no scanned sheet
                </span>
                <p className="text-xs text-muted-foreground">
                  They will be left blank, not marked absent.
                </p>
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {unscanned.map((student) => (
                    <li key={student.student_id} className="text-sm text-muted-foreground">
                      {student.roll_number} · {student.full_name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <ErrorState message={error} />}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={!isReady || applyMutation.isPending}>
                <Send className="size-4" aria-hidden="true" />
                Apply {matched.length} result{matched.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "default";
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded border border-border bg-card p-3">
      <Badge variant={tone}>{value}</Badge>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
