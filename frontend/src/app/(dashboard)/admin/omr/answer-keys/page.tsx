"use client";

import { AnswerKeySubjectPicker } from "@/components/modules/omr/answer-key-subject-picker";
import { ExamSubjectSource } from "@/components/modules/omr/exam-subject-source";

export default function AdminOmrAnswerKeysPage() {
  return (
    <ExamSubjectSource>
      {(examSubjects) => (
        <AnswerKeySubjectPicker examSubjects={examSubjects} basePath="/admin/omr/answer-keys" />
      )}
    </ExamSubjectSource>
  );
}
