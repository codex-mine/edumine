"use client";

import { CommunicationWorkspace } from "@/components/modules/communication/communication-workspace";
import { useAuth } from "@/providers/auth-provider";

export default function ReceptionistCommunicationPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  return (
    <CommunicationWorkspace
      basePath="/receptionist/communication"
      canManage={permissions.includes("communication.manage")}
      canDraftWithAI={false}
    />
  );
}
