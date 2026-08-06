"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { DetailSection } from "@/components/modules/people/detail/detail-shell";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAuditLogsQuery } from "@/hooks/use-audit";
import { describeAuditLog } from "@/lib/api/audit";

const LIMIT = 15;

/** One person's audit trail: what they did, and what was done to their record.
 * `subjectId` is their user id; `profileId` is their student/teacher record id,
 * which those modules log against instead — pass it or half the trail is lost. */
export function ActivityPanel({
  subjectId,
  profileId,
  dateFrom,
  dateTo,
  description,
}: {
  subjectId: string;
  profileId?: string;
  dateFrom?: string;
  dateTo?: string;
  description?: string;
}) {
  const [page, setPage] = useState(1);
  const query = useAuditLogsQuery({
    subject_id: subjectId,
    profile_id: profileId,
    date_from: dateFrom,
    date_to: dateTo,
    page,
    limit: LIMIT,
  });

  const logs = query.data?.items ?? [];
  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <DetailSection
      title="Activity"
      description={description ?? "Recorded changes involving this person, newest first."}
    >
      {query.isPending ? (
        <LoadingState label="Loading activity..." />
      ) : query.isError ? (
        <ErrorState message={loginErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : logs.length === 0 ? (
        <EmptyState message="No recorded activity for this period." />
      ) : (
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-start justify-between gap-4 rounded border border-border px-3 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{describeAuditLog(log)}</span>
                  <span className="text-xs text-muted-foreground">
                    {log.actor_name ? `by ${log.actor_name}` : "by the system"}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="muted">{log.entity_type.replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} &middot; {total} total
              </span>
              <div className="flex gap-2">
                <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </DetailSection>
  );
}
