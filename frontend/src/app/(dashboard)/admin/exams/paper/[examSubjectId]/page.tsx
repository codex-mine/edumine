"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { QuestionPaperView } from "@/components/modules/exams/question-paper-view";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useQuestionPaperQuery } from "@/hooks/use-exams";

export default function AdminQuestionPaperPage() {
  const params = useParams<{ examSubjectId: string }>();
  const router = useRouter();
  const query = useQuestionPaperQuery(params.examSubjectId);

  if (query.isPending) return <LoadingState label="Generating question paper..." />;
  if (query.isError) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/admin/exams/question-review")}>
          <ArrowLeft className="size-4" /> Back to question review
        </Button>
        <ErrorState message={loginErrorMessage(query.error)} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (!query.data) return null;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Toolbar is outside `print-area`, so it disappears on the printed sheet. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/exams/question-review")}>
          <ArrowLeft className="size-4" /> Back to question review
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-6" aria-hidden="true" /> Print paper
        </Button>
      </div>

      <div className="rounded border border-border bg-white shadow-sm">
        <QuestionPaperView paper={query.data} />
      </div>
    </div>
  );
}
