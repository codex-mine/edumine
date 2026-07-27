"use client";

import { CommunicationWorkspace } from "@/components/modules/communication/communication-workspace";
import { useAuth } from "@/providers/auth-provider";

export default function AdminCommunicationPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  return (
    <CommunicationWorkspace
      basePath="/admin/communication"
      canManage={permissions.includes("communication.manage")}
      canDraftWithAI={user?.role === "admin" || user?.role === "principal"}
    />
  );
}
