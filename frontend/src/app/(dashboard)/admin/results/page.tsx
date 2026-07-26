"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useExamsQuery } from "@/hooks/use-exams";
import { EXAM_STATUS_LABELS, type ExamStatus } from "@/lib/api/exams";

const STATUS_BADGE_VARIANT: Record<ExamStatus, "muted" | "warning" | "success" | "info"> = {
  draft: "muted",
  question_pending: "warning",
  ready: "success",
  results_pending: "info",
  published: "info",
};

export default function AdminResultsPage() {
  const examsQuery = useExamsQuery();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Result compilation</h1>
        <p className="text-sm text-muted-foreground">
          Track marks submission per exam and compile results for Principal approval.
        </p>
      </div>

      {examsQuery.isLoading ? (
        <LoadingState label="Loading exams..." />
      ) : examsQuery.isError ? (
        <ErrorState message={loginErrorMessage(examsQuery.error)} onRetry={() => examsQuery.refetch()} />
      ) : (examsQuery.data ?? []).length === 0 ? (
        <EmptyState message="No exams have been created yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {examsQuery.data!.map((exam) => (
            <Link key={exam.id} href={`/admin/results/${exam.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{exam.name}</CardTitle>
                    <Badge variant={STATUS_BADGE_VARIANT[exam.status]}>{EXAM_STATUS_LABELS[exam.status]}</Badge>
                  </div>
                  <CardDescription>
                    {exam.term ? `${exam.term} · ` : ""}
                    {exam.start_date} – {exam.end_date}
                  </CardDescription>
                  <p className="text-sm text-muted-foreground">
                    {exam.classes.length} class{exam.classes.length === 1 ? "" : "es"}:{" "}
                    {exam.classes.map((c) => c.class_name).join(", ")}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
