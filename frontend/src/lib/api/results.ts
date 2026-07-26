import { apiClient } from "@/lib/api/client";

export type PublicationStatus = "pending" | "approved" | "published" | "rejected";

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  pending: "Awaiting Principal approval",
  approved: "Approved — ready to publish",
  published: "Published",
  rejected: "Sent back for revision",
};

// --- Teacher: marks entry -----------------------------------------------------

export interface PendingMarkSummary {
  exam_subject_id: string;
  exam_id: string;
  exam_name: string;
  class_name: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
  marks_deadline: string;
  marks_submitted_at: string | null;
  is_overdue: boolean;
}

export interface StudentMark {
  student_id: string;
  admission_number: string;
  full_name: string;
  roll_number: string;
  section_name: string;
  marks_obtained: number | null;
  is_absent: boolean;
  grade: string | null;
  entered_at: string | null;
}

export interface MarksRoster {
  exam_subject_id: string;
  exam_id: string;
  exam_name: string;
  exam_status: string;
  class_name: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
  marks_deadline: string;
  marks_submitted_at: string | null;
  is_overdue: boolean;
  students: StudentMark[];
}

export interface MarkEntryItem {
  student_id: string;
  marks_obtained: number | null;
  is_absent: boolean;
}

export async function listMyPendingMarks(): Promise<PendingMarkSummary[]> {
  const { data } = await apiClient.get<PendingMarkSummary[]>("/results/exam-subjects/my-pending");
  return data;
}

export async function getMarksRoster(examSubjectId: string): Promise<MarksRoster> {
  const { data } = await apiClient.get<MarksRoster>(`/results/exam-subjects/${examSubjectId}/roster`);
  return data;
}

export async function saveMarks(examSubjectId: string, items: MarkEntryItem[]): Promise<MarksRoster> {
  const { data } = await apiClient.post<MarksRoster>(`/results/exam-subjects/${examSubjectId}/marks`, { items });
  return data;
}

export async function submitMarks(examSubjectId: string): Promise<MarksRoster> {
  const { data } = await apiClient.post<MarksRoster>(`/results/exam-subjects/${examSubjectId}/submit`, {});
  return data;
}

// --- Admin: compilation & submission for Principal approval --------------------

export interface CompilationStatus {
  exam_id: string;
  exam_name: string;
  exam_status: string;
  total_subjects: number;
  submitted_subjects: number;
  publication_status: PublicationStatus | null;
  submitted_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
}

export async function getCompilationStatus(examId: string): Promise<CompilationStatus> {
  const { data } = await apiClient.get<CompilationStatus>(`/results/exams/${examId}/compilation-status`);
  return data;
}

export async function compileAndSubmit(examId: string): Promise<CompilationStatus> {
  const { data } = await apiClient.post<CompilationStatus>(`/results/exams/${examId}/compile`, {});
  return data;
}

// --- Principal: approve / reject / publish -------------------------------------

export async function listPendingApproval(): Promise<CompilationStatus[]> {
  const { data } = await apiClient.get<CompilationStatus[]>("/results/exams/pending-approval");
  return data;
}

export async function approveResults(examId: string): Promise<CompilationStatus> {
  const { data } = await apiClient.post<CompilationStatus>(`/results/exams/${examId}/approve`, {});
  return data;
}

export async function rejectResults(examId: string, reason: string): Promise<CompilationStatus> {
  const { data } = await apiClient.post<CompilationStatus>(`/results/exams/${examId}/reject`, { reason });
  return data;
}

export async function publishResults(examId: string): Promise<CompilationStatus> {
  const { data } = await apiClient.post<CompilationStatus>(`/results/exams/${examId}/publish`, {});
  return data;
}

// --- Result cards & report cards (published data only) -------------------------

export interface ExamCardSubject {
  subject_name: string;
  full_marks: number;
  pass_marks: number;
  marks_obtained: number | null;
  is_absent: boolean;
  grade: string | null;
  passed: boolean;
}

export interface ExamCard {
  student_id: string;
  student_name: string;
  admission_number: string;
  exam_id: string;
  exam_name: string;
  term: string | null;
  class_name: string | null;
  subjects: ExamCardSubject[];
  total_obtained: number;
  total_full_marks: number;
  percentage: number;
  overall_grade: string | null;
  published_at: string | null;
}

export interface ReportCardExam {
  exam_id: string;
  exam_name: string;
  term: string | null;
  subjects: ExamCardSubject[];
  total_obtained: number;
  total_full_marks: number;
  percentage: number;
}

export interface ReportCard {
  student_id: string;
  student_name: string;
  admission_number: string;
  academic_year_id: string;
  academic_year_name: string;
  exams: ReportCardExam[];
  overall_total_obtained: number;
  overall_total_full_marks: number;
  overall_percentage: number;
  overall_grade: string | null;
}

export async function getMyExamCard(examId: string): Promise<ExamCard> {
  const { data } = await apiClient.get<ExamCard>(`/results/my/exams/${examId}/card`);
  return data;
}

export async function getMyReportCard(academicYearId?: string): Promise<ReportCard> {
  const { data } = await apiClient.get<ReportCard>("/results/my/report-card", {
    params: academicYearId ? { academic_year_id: academicYearId } : undefined,
  });
  return data;
}

export async function getStudentExamCard(studentId: string, examId: string): Promise<ExamCard> {
  const { data } = await apiClient.get<ExamCard>(`/results/students/${studentId}/exams/${examId}/card`);
  return data;
}

export async function getStudentReportCard(studentId: string, academicYearId?: string): Promise<ReportCard> {
  const { data } = await apiClient.get<ReportCard>(`/results/students/${studentId}/report-card`, {
    params: academicYearId ? { academic_year_id: academicYearId } : undefined,
  });
  return data;
}

// --- AI-assisted result insight summaries (published data only) ----------------

export interface InsightSummary {
  summary: string;
}

export async function getSubjectInsight(examSubjectId: string): Promise<InsightSummary> {
  const { data } = await apiClient.post<InsightSummary>(`/results/insights/exam-subjects/${examSubjectId}`, {});
  return data;
}

export async function getClassInsight(examId: string, classId: string): Promise<InsightSummary> {
  const { data } = await apiClient.post<InsightSummary>(
    `/results/insights/exams/${examId}/classes/${classId}`,
    {}
  );
  return data;
}

export async function getMyIndividualInsight(examId: string): Promise<InsightSummary> {
  const { data } = await apiClient.post<InsightSummary>(`/results/insights/my/exams/${examId}`, {});
  return data;
}

export async function getStudentIndividualInsight(studentId: string, examId: string): Promise<InsightSummary> {
  const { data } = await apiClient.post<InsightSummary>(
    `/results/insights/students/${studentId}/exams/${examId}`,
    {}
  );
  return data;
}
