"use client";

import { useParams } from "next/navigation";

import { BatchWorkspace } from "@/components/modules/omr/batch-workspace";

export default function TeacherOmrBatchPage() {
  const params = useParams<{ batchId: string }>();

  return (
    <BatchWorkspace
      batchId={params.batchId}
      backHref="/teacher/omr"
      answerKeysHref="/teacher/omr/answer-keys"
    />
  );
}
