import { apiClient } from "@/lib/api/client";

export type ExamStatus = "draft" | "question_pending" | "ready" | "results_pending" | "published";
export type QuestionType = "mcq" | "short" | "long";

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  draft: "Draft",
  question_pending: "Awaiting questions",
  ready: "Ready",
  results_pending: "Results pending",
  published: "Published",
};

export interface ExamClassSummary {
  class_id: string;
  class_name: string;
}

export interface Exam {
  id: string;
  academic_year_id: string;
  name: string;
  term: string | null;
  start_date: string;
  end_date: string;
  status: ExamStatus;
  created_by: string;
  created_at: string;
  classes: ExamClassSummary[];
  subjects?: ExamSubject[];
}

export interface CreateExamPayload {
  academic_year_id?: string | null;
  name: string;
  term?: string | null;
  start_date: string;
  end_date: string;
  class_ids: string[];
}

export interface CandidateSubject {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  teacher_id: string | null;
  teacher_name: string | null;
  default_full_marks: number;
  exam_subject_id: string | null;
}

export interface ExamSubjectConfigItem {
  class_id: string;
  subject_id: string;
  full_marks?: number | null;
  pass_marks: number;
  question_deadline: string;
  marks_deadline: string;
}

export interface ExamSubject {
  id: string;
  exam_id: string;
  exam_name: string;
  exam_status: ExamStatus;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  full_marks: number;
  pass_marks: number;
  question_deadline: string;
  question_submitted_at: string | null;
  marks_deadline: string;
  marks_submitted_at: string | null;
  is_overdue: boolean;
  extension_requested: boolean;
  questions: QuestionItem[] | null;
}

export interface QuestionItem {
  question_text: string;
  marks: number;
  type: QuestionType;
  options?: string[] | null;
}

export interface ExtensionRequest {
  exam_subject_id: string;
  exam_id: string;
  exam_name: string;
  class_name: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  current_deadline: string;
  requested_deadline: string | null;
  reason: string | null;
  requested_at: string;
}

export interface DraftQuestionsPayload {
  topics: string;
  question_count: number;
  question_type: "mcq" | "short" | "long" | "mixed";
}

export interface DraftQuestionsResult {
  questions: QuestionItem[];
  total_marks_check: number;
}

// --- Admin: exam creation & configuration -----------------------------------

export async function createExam(payload: CreateExamPayload): Promise<Exam> {
  const { data } = await apiClient.post<Exam>("/exams", payload);
  return data;
}

export async function listExams(params?: { academic_year_id?: string }): Promise<Exam[]> {
  const { data } = await apiClient.get<Exam[]>("/exams", { params });
  return data;
}

export async function getExam(examId: string): Promise<Exam> {
  const { data } = await apiClient.get<Exam>(`/exams/${examId}`);
  return data;
}

export async function listCandidateSubjects(examId: string): Promise<CandidateSubject[]> {
  const { data } = await apiClient.get<CandidateSubject[]>(`/exams/${examId}/candidate-subjects`);
  return data;
}

export async function configureExamSubjects(
  examId: string,
  items: ExamSubjectConfigItem[]
): Promise<ExamSubject[]> {
  const { data } = await apiClient.post<ExamSubject[]>(`/exams/${examId}/subjects`, { items });
  return data;
}

// --- Admin: deadline extension queue -----------------------------------------

export async function listExtensionRequests(): Promise<ExtensionRequest[]> {
  const { data } = await apiClient.get<ExtensionRequest[]>("/exams/subjects/extension-requests");
  return data;
}

export async function extendDeadline(examSubjectId: string, newDeadline: string): Promise<ExamSubject> {
  const { data } = await apiClient.patch<ExamSubject>(`/exams/subjects/${examSubjectId}/extend-deadline`, {
    new_deadline: newDeadline,
  });
  return data;
}

// --- Teacher: question submission --------------------------------------------

export async function listMySubmissions(): Promise<ExamSubject[]> {
  const { data } = await apiClient.get<ExamSubject[]>("/exams/subjects/my-submissions");
  return data;
}

export async function submitQuestions(examSubjectId: string, questions: QuestionItem[]): Promise<ExamSubject> {
  const { data } = await apiClient.post<ExamSubject>(`/exams/subjects/${examSubjectId}/submit`, { questions });
  return data;
}

export async function requestExtension(
  examSubjectId: string,
  payload: { reason: string; requested_deadline: string }
): Promise<ExamSubject> {
  const { data } = await apiClient.post<ExamSubject>(
    `/exams/subjects/${examSubjectId}/request-extension`,
    payload
  );
  return data;
}

export async function draftQuestions(
  examSubjectId: string,
  payload: DraftQuestionsPayload
): Promise<DraftQuestionsResult> {
  const { data } = await apiClient.post<DraftQuestionsResult>(
    `/exams/subjects/${examSubjectId}/draft-questions`,
    payload
  );
  return data;
}
