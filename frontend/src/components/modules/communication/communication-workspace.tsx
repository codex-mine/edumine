"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ComposeAnnouncementDialog } from "@/components/modules/communication/compose-announcement-dialog";
import { InboxAnnouncementsTable } from "@/components/modules/communication/inbox-announcements-table";
import { SentAnnouncementsTable } from "@/components/modules/communication/sent-announcements-table";

export function CommunicationWorkspace({
  basePath,
  canManage,
  canDraftWithAI,
}: {
  basePath: string;
  canManage: boolean;
  canDraftWithAI: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Communication</h1>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "Send targeted announcements and SMS updates, and review your inbox."
            : "Announcements addressed to you."}
        </p>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <ComposeAnnouncementDialog
            canDraftWithAI={canDraftWithAI}
            trigger={
              <Button >
                <Plus className="size-8" aria-hidden="true" />
                New announcement
              </Button>
            }
          />
        </div>
      )}

      {canManage && <SentAnnouncementsTable basePath={basePath} />}
      <InboxAnnouncementsTable basePath={basePath} />
    </div>
  );
}
