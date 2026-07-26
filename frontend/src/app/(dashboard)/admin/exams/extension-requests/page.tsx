"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { ExtendDeadlineDialog } from "@/components/modules/exams/extend-deadline-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useExtensionRequestsQuery } from "@/hooks/use-exams";

export default function ExtensionRequestsPage() {
  const requestsQuery = useExtensionRequestsQuery();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Deadline extension requests</h1>
        <p className="text-sm text-muted-foreground">
          Teachers who requested more time to submit exam questions. Extend the deadline to unlock submission.
        </p>
      </div>

      {requestsQuery.isLoading ? (
        <LoadingState label="Loading requests..." />
      ) : requestsQuery.isError ? (
        <ErrorState message={loginErrorMessage(requestsQuery.error)} onRetry={() => requestsQuery.refetch()} />
      ) : (requestsQuery.data ?? []).length === 0 ? (
        <EmptyState message="No pending deadline extension requests." />
      ) : (
        <div className="flex flex-col gap-3">
          {requestsQuery.data!.map((req) => (
            <Card key={req.exam_subject_id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>
                      {req.subject_name} — {req.class_name}
                    </CardTitle>
                    <CardDescription>
                      {req.exam_name} · Requested by {req.teacher_name} on {new Date(req.requested_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <ExtendDeadlineDialog
                    examSubjectId={req.exam_subject_id}
                    currentDeadline={req.requested_deadline ?? req.current_deadline}
                    subjectLabel={`${req.subject_name} — ${req.class_name}`}
                    trigger={<Button size="sm">Extend deadline</Button>}
                  />
                </div>
              </CardHeader>
              <div className="flex flex-col gap-1 px-4 pb-4 text-sm">
                <p>
                  <span className="text-muted-foreground">Current deadline: </span>
                  {new Date(req.current_deadline).toLocaleString()}
                </p>
                {req.requested_deadline && (
                  <p>
                    <span className="text-muted-foreground">Requested deadline: </span>
                    {new Date(req.requested_deadline).toLocaleString()}
                  </p>
                )}
                {req.reason && (
                  <p>
                    <span className="text-muted-foreground">Reason: </span>
                    {req.reason}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
