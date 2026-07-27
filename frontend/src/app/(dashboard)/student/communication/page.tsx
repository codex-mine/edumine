"use client";

import { CommunicationWorkspace } from "@/components/modules/communication/communication-workspace";

export default function StudentCommunicationPage() {
  return <CommunicationWorkspace basePath="/student/communication" canManage={false} canDraftWithAI={false} />;
}
