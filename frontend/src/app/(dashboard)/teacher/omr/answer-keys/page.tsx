"use client";

import { AnswerKeySubjectPicker } from "@/components/modules/omr/answer-key-subject-picker";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyPendingMarksQuery } from "@/hooks/use-results";
import type { ExamSubjectOption } from "@/components/modules/omr/batch-list";

export default function TeacherOmrAnswerKeysPage() {
  const marksQuery = useMyPendingMarksQuery();

  if (marksQuery.isLoading) return <LoadingState label="Loading your subjects..." />;
  if (marksQuery.isError) {
    return (
      <ErrorState message={loginErrorMessage(marksQuery.error)} onRetry={() => marksQuery.refetch()} />
    );
  }

  const examSubjects: ExamSubjectOption[] = (marksQuery.data ?? []).map((item) => ({
    id: item.exam_subject_id,
    label: `${item.subject_name} · ${item.class_name}`,
    description: item.exam_name,
  }));

  return (
    <AnswerKeySubjectPicker examSubjects={examSubjects} basePath="/teacher/omr/answer-keys" />
  );
}
