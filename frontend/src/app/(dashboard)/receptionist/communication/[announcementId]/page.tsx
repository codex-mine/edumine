"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { AnnouncementDetailView } from "@/components/modules/communication/announcement-detail-view";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAnnouncementQuery } from "@/hooks/use-communication";
import { useAuth } from "@/providers/auth-provider";

export default function ReceptionistAnnouncementDetailPage() {
  const params = useParams<{ announcementId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const announcementQuery = useAnnouncementQuery(params.announcementId);

  if (announcementQuery.isLoading) return <LoadingState label="Loading announcement..." />;
  if (announcementQuery.isError || !announcementQuery.data) {
    return <ErrorState message={loginErrorMessage(announcementQuery.error)} onRetry={() => announcementQuery.refetch()} />;
  }

  const permissions = user?.permissions ?? [];

  return (
    <div className="flex w-full flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/receptionist/communication")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to communication
      </Button>
      <AnnouncementDetailView announcement={announcementQuery.data} canManage={permissions.includes("communication.manage")} />
    </div>
  );
}
