"use client";

import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { InsightSummaryCard } from "@/components/modules/results/insight-summary-card";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useExamQuery } from "@/hooks/use-exams";
import { useClassInsightMutation, useCompilationStatusQuery, useCompileAndSubmitMutation } from "@/hooks/use-results";
import { PUBLICATION_STATUS_LABELS, type PublicationStatus } from "@/lib/api/results";

const PUBLICATION_BADGE_VARIANT: Record<PublicationStatus, "muted" | "warning" | "success" | "info" | "destructive"> = {
  pending: "warning",
  approved: "info",
  published: "success",
  rejected: "destructive",
};

export default function AdminResultCompilationPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;

  const examQuery = useExamQuery(examId);
  const statusQuery = useCompilationStatusQuery(examId);
  const compileMutation = useCompileAndSubmitMutation(examId);
  const classInsightMutation = useClassInsightMutation();

  if (examQuery.isLoading || statusQuery.isLoading) return <LoadingState label="Loading exam..." />;
  if (examQuery.isError || !examQuery.data) {
    return <ErrorState message={loginErrorMessage(examQuery.error)} onRetry={() => examQuery.refetch()} />;
  }
  if (statusQuery.isError || !statusQuery.data) {
    return <ErrorState message={loginErrorMessage(statusQuery.error)} onRetry={() => statusQuery.refetch()} />;
  }

  const exam = examQuery.data;
  const status = statusQuery.data;
  const allSubmitted = status.total_subjects > 0 && status.submitted_subjects === status.total_subjects;
  const canCompile = allSubmitted && (status.publication_status === null || status.publication_status === "rejected");

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">{exam.name}</h1>
        <p className="text-sm text-muted-foreground">
          {exam.term ? `${exam.term} · ` : ""}
          {exam.start_date} – {exam.end_date} · Classes: {exam.classes.map((c) => c.class_name).join(", ")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compilation status</CardTitle>
          <CardDescription>Every subject must have marks submitted before results can be compiled.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-4 rounded border border-border p-3 text-sm">
            <span>
              Subjects submitted:{" "}
              <span className="font-medium text-foreground">
                {status.submitted_subjects} / {status.total_subjects}
              </span>
            </span>
            <span>
              Publication status:{" "}
              {status.publication_status ? (
                <Badge variant={PUBLICATION_BADGE_VARIANT[status.publication_status]}>
                  {PUBLICATION_STATUS_LABELS[status.publication_status]}
                </Badge>
              ) : (
                <Badge variant="muted">Not yet submitted</Badge>
              )}
            </span>
          </div>
          {!allSubmitted && <p className="text-sm text-muted-foreground">Waiting on marks from all assigned teachers.</p>}
          {canCompile && (
            <div className="flex justify-end">
              <Button onClick={() => compileMutation.mutate()} disabled={compileMutation.isPending}>
                {compileMutation.isPending ? "Submitting..." : "Compile & submit for approval"}
              </Button>
            </div>
          )}
          {compileMutation.isError && (
            <p className="text-sm text-destructive">{loginErrorMessage(compileMutation.error)}</p>
          )}
        </div>
      </Card>

      {status.publication_status === "published" &&
        exam.classes.map((c) => (
          <InsightSummaryCard
            key={c.class_id}
            title={`Class insight — ${c.class_name}`}
            description={`Plain-language summary of published results for ${c.class_name} across all subjects in ${exam.name}.`}
            onGenerate={() => classInsightMutation.mutateAsync({ examId, classId: c.class_id })}
            isPending={classInsightMutation.isPending}
          />
        ))}
    </div>
  );
}
