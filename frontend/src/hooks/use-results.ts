import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveResults,
  compileAndSubmit,
  getClassInsight,
  getCompilationStatus,
  getMarksRoster,
  getMyExamCard,
  getMyIndividualInsight,
  getMyReportCard,
  getStudentExamCard,
  getStudentIndividualInsight,
  getStudentReportCard,
  getSubjectInsight,
  listMyPendingMarks,
  listPendingApproval,
  publishResults,
  rejectResults,
  saveMarks,
  submitMarks,
  type MarkEntryItem,
} from "@/lib/api/results";

// --- Teacher: marks entry -----------------------------------------------------

export const myPendingMarksQueryKey = ["results", "my-pending-marks"] as const;

export function useMyPendingMarksQuery() {
  return useQuery({ queryKey: myPendingMarksQueryKey, queryFn: listMyPendingMarks });
}

export const marksRosterQueryKey = (examSubjectId: string) => ["results", "roster", examSubjectId] as const;

export function useMarksRosterQuery(examSubjectId: string) {
  return useQuery({
    queryKey: marksRosterQueryKey(examSubjectId),
    queryFn: () => getMarksRoster(examSubjectId),
    enabled: Boolean(examSubjectId),
  });
}

export function useSaveMarksMutation(examSubjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: MarkEntryItem[]) => saveMarks(examSubjectId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marksRosterQueryKey(examSubjectId) });
      queryClient.invalidateQueries({ queryKey: myPendingMarksQueryKey });
    },
  });
}

export function useSubmitMarksMutation(examSubjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => submitMarks(examSubjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marksRosterQueryKey(examSubjectId) });
      queryClient.invalidateQueries({ queryKey: myPendingMarksQueryKey });
    },
  });
}

// --- Admin: compilation & submission for Principal approval --------------------

export const compilationStatusQueryKey = (examId: string) => ["results", "compilation-status", examId] as const;

export function useCompilationStatusQuery(examId: string) {
  return useQuery({
    queryKey: compilationStatusQueryKey(examId),
    queryFn: () => getCompilationStatus(examId),
    enabled: Boolean(examId),
  });
}

export function useCompileAndSubmitMutation(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => compileAndSubmit(examId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: compilationStatusQueryKey(examId) }),
  });
}

// --- Principal: approve / reject / publish -------------------------------------

export const pendingApprovalQueryKey = ["results", "pending-approval"] as const;

export function usePendingApprovalQuery() {
  return useQuery({ queryKey: pendingApprovalQueryKey, queryFn: listPendingApproval });
}

export function useApproveResultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => approveResults(examId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingApprovalQueryKey }),
  });
}

export function useRejectResultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, reason }: { examId: string; reason: string }) => rejectResults(examId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingApprovalQueryKey }),
  });
}

export function usePublishResultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => publishResults(examId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingApprovalQueryKey }),
  });
}

// --- Result cards & report cards -----------------------------------------------

export function useMyExamCardQuery(examId: string) {
  return useQuery({
    queryKey: ["results", "my-exam-card", examId],
    queryFn: () => getMyExamCard(examId),
    enabled: Boolean(examId),
  });
}

export function useMyReportCardQuery(academicYearId?: string) {
  return useQuery({
    queryKey: ["results", "my-report-card", academicYearId ?? "active"],
    queryFn: () => getMyReportCard(academicYearId),
  });
}

export function useStudentExamCardQuery(studentId: string, examId: string) {
  return useQuery({
    queryKey: ["results", "student-exam-card", studentId, examId],
    queryFn: () => getStudentExamCard(studentId, examId),
    enabled: Boolean(studentId) && Boolean(examId),
  });
}

export function useStudentReportCardQuery(studentId: string, academicYearId?: string) {
  return useQuery({
    queryKey: ["results", "student-report-card", studentId, academicYearId ?? "active"],
    queryFn: () => getStudentReportCard(studentId, academicYearId),
    enabled: Boolean(studentId),
  });
}

// --- AI-assisted result insight summaries ---------------------------------------

export function useSubjectInsightMutation() {
  return useMutation({ mutationFn: (examSubjectId: string) => getSubjectInsight(examSubjectId) });
}

export function useClassInsightMutation() {
  return useMutation({
    mutationFn: ({ examId, classId }: { examId: string; classId: string }) => getClassInsight(examId, classId),
  });
}

export function useMyIndividualInsightMutation() {
  return useMutation({ mutationFn: (examId: string) => getMyIndividualInsight(examId) });
}

export function useStudentIndividualInsightMutation() {
  return useMutation({
    mutationFn: ({ studentId, examId }: { studentId: string; examId: string }) =>
      getStudentIndividualInsight(studentId, examId),
  });
}
