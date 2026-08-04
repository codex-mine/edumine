"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";

import { BatchList } from "@/components/modules/omr/batch-list";
import { ExamSubjectSource } from "@/components/modules/omr/exam-subject-source";
import { Button } from "@/components/ui/button";

export default function AdminOmrPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/omr/answer-keys">
            <KeyRound className="size-4" aria-hidden="true" />
            Manage answer keys
          </Link>
        </Button>
      </div>
      <ExamSubjectSource>
        {(examSubjects) => (
          <BatchList examSubjects={examSubjects} basePath="/admin/omr/batches" />
        )}
      </ExamSubjectSource>
    </div>
  );
}
