"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AnswerKeyEditor } from "@/components/modules/omr/answer-key-editor";
import { Button } from "@/components/ui/button";

export default function TeacherOmrAnswerKeyPage() {
  const params = useParams<{ examSubjectId: string }>();

  return (
    <div className="flex w-full flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/teacher/omr/answer-keys">
          <ArrowLeft className="size-4" aria-hidden="true" />
          All subjects
        </Link>
      </Button>
      <AnswerKeyEditor examSubjectId={params.examSubjectId} />
    </div>
  );
}
