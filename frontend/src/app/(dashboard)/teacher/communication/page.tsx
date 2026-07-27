"use client";

import { CommunicationWorkspace } from "@/components/modules/communication/communication-workspace";

export default function TeacherCommunicationPage() {
  return <CommunicationWorkspace basePath="/teacher/communication" canManage={false} canDraftWithAI={false} />;
}
