"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExamQuery, useExamsQuery } from "@/hooks/use-exams";
import type { ExamSubjectOption } from "@/components/modules/omr/batch-list";

/**
 * Admin-facing exam subject picker.
 *
 * Teachers reach their scannable subjects straight from their marks-entry queue,
 * but an Admin is not assigned to any subject, so they choose an exam first and
 * this resolves its configured subjects.
 */
export function ExamSubjectSource({
  children,
}: {
  children: (examSubjects: ExamSubjectOption[]) => React.ReactNode;
}) {
  const examsQuery = useExamsQuery();
  const [examId, setExamId] = useState<string>("");
  const examQuery = useExamQuery(examId);

  const examSubjects: ExamSubjectOption[] = (examQuery.data?.subjects ?? []).map((subject) => ({
    id: subject.id,
    label: `${subject.subject_name} · ${subject.class_name}`,
    description: `${subject.exam_name} · ${subject.teacher_name}`,
  }));

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full max-w-sm flex-col gap-1.5">
        <Label htmlFor="omr-exam">Exam</Label>
        <Select value={examId} onValueChange={setExamId}>
          <SelectTrigger id="omr-exam">
            <SelectValue placeholder="Choose an exam to see its subjects" />
          </SelectTrigger>
          <SelectContent>
            {(examsQuery.data ?? []).map((exam) => (
              <SelectItem key={exam.id} value={exam.id}>
                {exam.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {children(examSubjects)}
    </div>
  );
}
