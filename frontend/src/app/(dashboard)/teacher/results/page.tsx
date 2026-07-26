"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyPendingMarksQuery } from "@/hooks/use-results";

export default function TeacherResultsPage() {
  const marksQuery = useMyPendingMarksQuery();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Marks entry</h1>
        <p className="text-sm text-muted-foreground">
          Enter exam marks for your assigned subjects before the submission deadline.
        </p>
      </div>

      {marksQuery.isLoading ? (
        <LoadingState label="Loading your assignments..." />
      ) : marksQuery.isError ? (
        <ErrorState message={loginErrorMessage(marksQuery.error)} onRetry={() => marksQuery.refetch()} />
      ) : (marksQuery.data ?? []).length === 0 ? (
        <EmptyState message="You have no marks entry assignments right now." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {marksQuery.data!.map((item) => (
            <Card key={item.exam_subject_id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{item.subject_name}</CardTitle>
                  {item.marks_submitted_at ? (
                    <Badge variant="success">Submitted</Badge>
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
                  Deadline: {new Date(item.marks_deadline).toLocaleString()}
                </p>
              </CardHeader>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                <Button asChild size="sm">
                  <Link href={`/teacher/results/${item.exam_subject_id}`}>
                    {item.marks_submitted_at ? "View marks" : "Enter marks"}
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
