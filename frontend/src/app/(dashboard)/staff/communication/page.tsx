"use client";

import { CommunicationWorkspace } from "@/components/modules/communication/communication-workspace";

export default function StaffCommunicationPage() {
  return <CommunicationWorkspace basePath="/staff/communication" canManage={false} canDraftWithAI={false} />;
}
