"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";

import { BatchList, type ExamSubjectOption } from "@/components/modules/omr/batch-list";
import { Button } from "@/components/ui/button";
import { useMyPendingMarksQuery } from "@/hooks/use-results";

export default function TeacherOmrPage() {
  // A teacher's scannable subjects are exactly the ones they enter marks for.
  const marksQuery = useMyPendingMarksQuery();

  const examSubjects: ExamSubjectOption[] = (marksQuery.data ?? []).map((item) => ({
    id: item.exam_subject_id,
    label: `${item.subject_name} · ${item.class_name}`,
    description: item.exam_name,
  }));

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild variant="outline"  >
          <Link href="/teacher/omr/answer-keys">
            <KeyRound className="size-8" aria-hidden="true" />
            Manage answer keys
          </Link>
        </Button>
      </div>
      <BatchList examSubjects={examSubjects} basePath="/teacher/omr/batches" />
    </div>
  );
}
