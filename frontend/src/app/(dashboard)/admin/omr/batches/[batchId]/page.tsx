"use client";

import { useParams } from "next/navigation";

import { BatchWorkspace } from "@/components/modules/omr/batch-workspace";

export default function AdminOmrBatchPage() {
  const params = useParams<{ batchId: string }>();

  return (
    <BatchWorkspace
      batchId={params.batchId}
      backHref="/admin/omr"
      answerKeysHref="/admin/omr/answer-keys"
    />
  );
}
