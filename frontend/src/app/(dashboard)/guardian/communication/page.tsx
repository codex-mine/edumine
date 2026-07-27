"use client";

import { CommunicationWorkspace } from "@/components/modules/communication/communication-workspace";

export default function GuardianCommunicationPage() {
  return <CommunicationWorkspace basePath="/guardian/communication" canManage={false} canDraftWithAI={false} />;
}
