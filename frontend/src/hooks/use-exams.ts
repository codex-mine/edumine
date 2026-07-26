import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  configureExamSubjects,
  createExam,
  draftQuestions,
  extendDeadline,
  getExam,
  listCandidateSubjects,
  listExams,
  listExtensionRequests,
  listMySubmissions,
  requestExtension,
  submitQuestions,
  type CreateExamPayload,
  type DraftQuestionsPayload,
  type ExamSubjectConfigItem,
  type QuestionItem,
} from "@/lib/api/exams";

// --- Admin: exams -------------------------------------------------------------

export const examsQueryKey = (academicYearId?: string) => ["exams", "list", academicYearId ?? "all"] as const;

export function useExamsQuery(academicYearId?: string) {
  return useQuery({
    queryKey: examsQueryKey(academicYearId),
    queryFn: () => listExams(academicYearId ? { academic_year_id: academicYearId } : undefined),
  });
}

export const examQueryKey = (examId: string) => ["exams", "detail", examId] as const;

export function useExamQuery(examId: string) {
  return useQuery({ queryKey: examQueryKey(examId), queryFn: () => getExam(examId), enabled: Boolean(examId) });
}

export function useCreateExamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExamPayload) => createExam(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exams", "list"] }),
  });
}

export const candidateSubjectsQueryKey = (examId: string) => ["exams", "candidate-subjects", examId] as const;

export function useCandidateSubjectsQuery(examId: string) {
  return useQuery({
    queryKey: candidateSubjectsQueryKey(examId),
    queryFn: () => listCandidateSubjects(examId),
    enabled: Boolean(examId),
  });
}

export function useConfigureExamSubjectsMutation(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: ExamSubjectConfigItem[]) => configureExamSubjects(examId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examQueryKey(examId) });
      queryClient.invalidateQueries({ queryKey: candidateSubjectsQueryKey(examId) });
      queryClient.invalidateQueries({ queryKey: ["exams", "list"] });
    },
  });
}

// --- Admin: deadline extension queue -----------------------------------------

export const extensionRequestsQueryKey = ["exams", "extension-requests"] as const;

export function useExtensionRequestsQuery() {
  return useQuery({ queryKey: extensionRequestsQueryKey, queryFn: listExtensionRequests });
}

export function useExtendDeadlineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examSubjectId, newDeadline }: { examSubjectId: string; newDeadline: string }) =>
      extendDeadline(examSubjectId, newDeadline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: extensionRequestsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
  });
}

// --- Teacher: question submission --------------------------------------------

export const mySubmissionsQueryKey = ["exams", "my-submissions"] as const;

export function useMySubmissionsQuery() {
  return useQuery({ queryKey: mySubmissionsQueryKey, queryFn: listMySubmissions });
}

export function useSubmitQuestionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examSubjectId, questions }: { examSubjectId: string; questions: QuestionItem[] }) =>
      submitQuestions(examSubjectId, questions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mySubmissionsQueryKey }),
  });
}

export function useRequestExtensionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      examSubjectId,
      reason,
      requestedDeadline,
    }: {
      examSubjectId: string;
      reason: string;
      requestedDeadline: string;
    }) => requestExtension(examSubjectId, { reason, requested_deadline: requestedDeadline }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mySubmissionsQueryKey }),
  });
}

export function useDraftQuestionsMutation() {
  return useMutation({
    mutationFn: ({ examSubjectId, payload }: { examSubjectId: string; payload: DraftQuestionsPayload }) =>
      draftQuestions(examSubjectId, payload),
  });
}
