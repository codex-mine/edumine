"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { RequestExtensionDialog } from "@/components/modules/exams/request-extension-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMySubmissionsQuery } from "@/hooks/use-exams";
import { QUESTION_STATUS_LABELS, QUESTION_STATUS_VARIANT } from "@/lib/api/exams";

export default function TeacherExamsPage() {
  const submissionsQuery = useMySubmissionsQuery();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Exam question submission</h1>
        <p className="text-sm text-muted-foreground">
          Prepare and submit exam questions for your assigned subjects before the deadline.
        </p>
      </div>

      {submissionsQuery.isLoading ? (
        <LoadingState label="Loading your assignments..." />
      ) : submissionsQuery.isError ? (
        <ErrorState message={loginErrorMessage(submissionsQuery.error)} onRetry={() => submissionsQuery.refetch()} />
      ) : (submissionsQuery.data ?? []).length === 0 ? (
        <EmptyState message="You have no exam question assignments right now." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {submissionsQuery.data!.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{item.subject_name}</CardTitle>
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
                <CardDescription>
                  {item.class_name} · {item.exam_name}
                </CardDescription>
                <p className="text-sm text-muted-foreground">
                  Deadline: {new Date(item.question_deadline).toLocaleString()}
                  {item.extension_requested && !item.question_submitted_at && (
                    <span className="ml-2 text-info">Extension requested</span>
                  )}
                </p>
                {item.question_status === "revision_requested" && item.question_review_note && (
                  <p className="rounded border border-destructive/40 bg-destructive/5 p-2 text-sm text-foreground">
                    <span className="font-medium text-destructive">Changes requested: </span>
                    {item.question_review_note}
                  </p>
                )}
              </CardHeader>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                <Button asChild size="sm">
                  <Link href={`/teacher/exams/${item.id}`}>
                    {item.question_status === "revision_requested"
                      ? "Revise questions"
                      : item.question_submitted_at
                        ? "View submission"
                        : "Prepare questions"}
                  </Link>
                </Button>
                {!item.question_submitted_at && !item.extension_requested && (
                  <RequestExtensionDialog
                    examSubjectId={item.id}
                    subjectLabel={`${item.subject_name} — ${item.class_name}`}
                    trigger={
                      <Button size="sm" variant="outline">
                        Request extension
                      </Button>
                    }
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
