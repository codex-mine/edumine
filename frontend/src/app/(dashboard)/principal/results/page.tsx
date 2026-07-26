"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { RejectResultsDialog } from "@/components/modules/results/reject-results-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useApproveResultsMutation, usePendingApprovalQuery, usePublishResultsMutation } from "@/hooks/use-results";
import { PUBLICATION_STATUS_LABELS } from "@/lib/api/results";

export default function PrincipalResultsPage() {
  const queueQuery = usePendingApprovalQuery();
  const approveMutation = useApproveResultsMutation();
  const publishMutation = usePublishResultsMutation();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Result approval & publishing</h1>
        <p className="text-sm text-muted-foreground">
          Exams compiled by Admin await your approval here. Results stay invisible to students and guardians until
          you publish them.
        </p>
      </div>

      {queueQuery.isLoading ? (
        <LoadingState label="Loading queue..." />
      ) : queueQuery.isError ? (
        <ErrorState message={loginErrorMessage(queueQuery.error)} onRetry={() => queueQuery.refetch()} />
      ) : (queueQuery.data ?? []).length === 0 ? (
        <EmptyState message="No exams are currently awaiting your action." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {queueQuery.data!.map((item) => (
            <Card key={item.exam_id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{item.exam_name}</CardTitle>
                  {item.publication_status && (
                    <Badge variant={item.publication_status === "approved" ? "info" : "warning"}>
                      {PUBLICATION_STATUS_LABELS[item.publication_status]}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {item.submitted_subjects} / {item.total_subjects} subjects submitted
                </CardDescription>
              </CardHeader>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                {item.publication_status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(item.exam_id)}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                    <RejectResultsDialog
                      examId={item.exam_id}
                      examLabel={item.exam_name}
                      trigger={
                        <Button size="sm" variant="destructive">
                          Send back
                        </Button>
                      }
                    />
                  </>
                )}
                {item.publication_status === "approved" && (
                  <Button
                    size="sm"
                    onClick={() => publishMutation.mutate(item.exam_id)}
                    disabled={publishMutation.isPending}
                  >
                    Publish
                  </Button>
                )}
              </div>
              {(approveMutation.isError || publishMutation.isError) && (
                <p className="px-4 pb-4 text-sm text-destructive">
                  {loginErrorMessage(approveMutation.error ?? publishMutation.error)}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
