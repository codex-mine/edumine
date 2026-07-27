"use client";

import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAnnouncementSmsLogsQuery, useMarkAnnouncementReadMutation } from "@/hooks/use-communication";
import { AUDIENCE_TYPE_LABELS, SMS_STATUS_LABELS, type Announcement, type SmsStatus } from "@/lib/api/communication";

const SMS_STATUS_BADGE_VARIANT: Record<SmsStatus, "success" | "warning" | "destructive"> = {
  sent: "success",
  queued: "warning",
  failed: "destructive",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AnnouncementDetailView({ announcement, canManage }: { announcement: Announcement; canManage: boolean }) {
  const markReadMutation = useMarkAnnouncementReadMutation();
  const smsLogsQuery = useAnnouncementSmsLogsQuery(canManage ? announcement.id : null);

  useEffect(() => {
    // Best-effort read receipt — silently ignored if the current viewer isn't
    // a recipient of this announcement (e.g. the sender viewing their own).
    markReadMutation.mutate(announcement.id, { onError: () => {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement.id]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{announcement.title}</CardTitle>
          <CardDescription>
            {announcement.section_label ?? AUDIENCE_TYPE_LABELS[announcement.audience_type]} &middot; From{" "}
            {announcement.created_by_name}
            {announcement.published_at && <> &middot; {formatDateTime(announcement.published_at)}</>}
            {canManage && <> &middot; {announcement.recipient_count} recipients</>}
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          <p className="whitespace-pre-wrap text-sm text-foreground">{announcement.body}</p>
        </div>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>SMS delivery status</CardTitle>
            <CardDescription>Per-recipient delivery outcome for this announcement&apos;s SMS send.</CardDescription>
          </CardHeader>

          {smsLogsQuery.isLoading ? (
            <LoadingState label="Loading delivery status..." />
          ) : smsLogsQuery.isError ? (
            <div className="px-4 pb-4">
              <ErrorState message={loginErrorMessage(smsLogsQuery.error)} onRetry={() => smsLogsQuery.refetch()} />
            </div>
          ) : (smsLogsQuery.data ?? []).length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState message="No SMS was sent for this announcement." />
            </div>
          ) : (
            <div className="overflow-x-auto px-4 pb-4">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Recipient phone</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Sent at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(smsLogsQuery.data ?? []).map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 text-foreground">{log.recipient_phone}</td>
                      <td className="px-3 py-2">
                        <Badge variant={SMS_STATUS_BADGE_VARIANT[log.status]}>{SMS_STATUS_LABELS[log.status]}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {log.sent_at ? formatDateTime(log.sent_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
