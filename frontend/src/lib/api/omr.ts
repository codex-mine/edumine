import { apiClient } from "@/lib/api/client";

export const ANSWER_OPTIONS = ["Ka", "Kha", "Ga", "Gha"] as const;
export type AnswerOption = (typeof ANSWER_OPTIONS)[number];

export const SET_CODES = ["Ka", "Kha", "Ga", "Gha", "Nga", "Cha"] as const;
export type SetCode = (typeof SET_CODES)[number];

export type BatchStatus = "draft" | "processing" | "ready" | "applied" | "failed";
export type SheetStatus = "pending" | "processed" | "needs_review" | "failed" | "applied";
export type MatchStatus =
  | "matched"
  | "unmatched"
  | "ambiguous"
  | "duplicate"
  | "unreadable"
  | "manual";

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  draft: "No sheets yet",
  processing: "Needs review",
  ready: "Ready to apply",
  applied: "Applied to roster",
  failed: "Failed",
};

export const SHEET_STATUS_LABELS: Record<SheetStatus, string> = {
  pending: "Pending",
  processed: "Read cleanly",
  needs_review: "Needs review",
  failed: "Could not read",
  applied: "Applied",
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  matched: "Matched",
  unmatched: "No student found",
  ambiguous: "Several students match",
  duplicate: "Duplicate scan",
  unreadable: "Roll unreadable",
  manual: "Assigned by hand",
};

// --- Eligibility --------------------------------------------------------------

export interface OmrEligibility {
  exam_subject_id: string;
  eligible: boolean;
  mcq_full_marks: number | null;
  source: string | null;
  section_name: string | null;
  reason: string | null;
  answer_key_set_codes: string[];
  has_applied_batch: boolean;
}

export async function getEligibility(examSubjectId: string): Promise<OmrEligibility> {
  const { data } = await apiClient.get<OmrEligibility>(
    `/omr/exam-subjects/${examSubjectId}/eligibility`
  );
  return data;
}

// --- Answer keys --------------------------------------------------------------

/** A question is either a bare option, or an option with its own marks. */
export type AnswerKeyEntry = string | { correct: string; marks: number; negative: number };

export interface AnswerKey {
  id: string;
  exam_subject_id: string;
  set_code: string;
  total_questions: number;
  answers: Record<string, AnswerKeyEntry>;
  marks_per_correct: number;
  negative_marks: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SaveAnswerKeyPayload {
  total_questions: number;
  answers: Record<string, string>;
  marks_per_correct?: number;
  negative_marks?: number;
}

export function answerKeyOption(entry: AnswerKeyEntry | undefined): string {
  if (!entry) return "";
  return typeof entry === "string" ? entry : entry.correct;
}

export async function listAnswerKeys(examSubjectId: string): Promise<AnswerKey[]> {
  const { data } = await apiClient.get<AnswerKey[]>(
    `/omr/exam-subjects/${examSubjectId}/answer-keys`
  );
  return data;
}

export async function saveAnswerKey(
  examSubjectId: string,
  setCode: string,
  payload: SaveAnswerKeyPayload
): Promise<AnswerKey> {
  const { data } = await apiClient.put<AnswerKey>(
    `/omr/exam-subjects/${examSubjectId}/answer-keys/${setCode}`,
    payload
  );
  return data;
}

export async function deleteAnswerKey(answerKeyId: string): Promise<void> {
  await apiClient.delete(`/omr/answer-keys/${answerKeyId}`);
}

// --- Batches ------------------------------------------------------------------

export interface OmrBatch {
  id: string;
  exam_subject_id: string;
  name: string;
  status: BatchStatus;
  template_name: string;
  mcq_full_marks: number;
  sheet_count: number;
  processed_count: number;
  matched_count: number;
  failed_count: number;
  uploaded_by: string;
  applied_by: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createBatch(examSubjectId: string, name: string): Promise<OmrBatch> {
  const { data } = await apiClient.post<OmrBatch>("/omr/batches", {
    exam_subject_id: examSubjectId,
    name,
  });
  return data;
}

export async function listBatches(params?: {
  exam_subject_id?: string;
  status?: BatchStatus;
}): Promise<OmrBatch[]> {
  const { data } = await apiClient.get<OmrBatch[]>("/omr/batches", { params });
  return data;
}

export async function getBatch(batchId: string): Promise<OmrBatch> {
  const { data } = await apiClient.get<OmrBatch>(`/omr/batches/${batchId}`);
  return data;
}

export async function deleteBatch(batchId: string): Promise<void> {
  await apiClient.delete(`/omr/batches/${batchId}`);
}

// --- Sheets -------------------------------------------------------------------

export interface OmrSheet {
  id: string;
  batch_id: string;
  status: SheetStatus;
  match_status: MatchStatus | null;
  original_filename: string;
  image_url: string;
  annotated_image_url: string | null;
  detected_class: number | null;
  detected_roll: string | null;
  detected_subject_code: string | null;
  detected_set_code: string | null;
  alignment_method: string | null;
  student_id: string | null;
  student_name?: string | null;
  matched_manually: boolean;
  correct_count: number | null;
  wrong_count: number | null;
  blank_count: number | null;
  multiple_count: number | null;
  marks_obtained: number | null;
  percentage: number | null;
  review_note: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface SheetAnswer {
  answer: string;
  fill_score: number;
  status: string;
  confidence: string;
  all_scores?: Record<string, number>;
  overridden?: boolean;
}

export interface SheetScoreDetail {
  student: string;
  correct: string;
  status: string;
  marks: number;
  confidence: string;
  fill_score: number;
}

export interface OmrSheetDetail extends OmrSheet {
  answers: Record<string, SheetAnswer> | null;
  score_details: Record<string, SheetScoreDetail> | null;
}

export interface RejectedUpload {
  filename: string;
  reason: string;
}

export interface UploadSheetsResult {
  batch: OmrBatch;
  sheets: OmrSheet[];
  rejected: RejectedUpload[];
}

export async function uploadSheets(
  batchId: string,
  files: File[],
  onProgress?: (percent: number) => void
): Promise<UploadSheetsResult> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }
  const { data } = await apiClient.post<UploadSheetsResult>(
    `/omr/batches/${batchId}/sheets`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    }
  );
  return data;
}

export async function listSheets(
  batchId: string,
  params?: { status?: SheetStatus; match_status?: MatchStatus }
): Promise<OmrSheet[]> {
  const { data } = await apiClient.get<OmrSheet[]>(`/omr/batches/${batchId}/sheets`, { params });
  return data;
}

export async function getSheet(sheetId: string): Promise<OmrSheetDetail> {
  const { data } = await apiClient.get<OmrSheetDetail>(`/omr/sheets/${sheetId}`);
  return data;
}

export interface PatchSheetPayload {
  student_id?: string;
  answer_overrides?: Record<string, string>;
  review_note?: string;
}

export async function patchSheet(
  sheetId: string,
  payload: PatchSheetPayload
): Promise<OmrSheetDetail> {
  const { data } = await apiClient.patch<OmrSheetDetail>(`/omr/sheets/${sheetId}`, payload);
  return data;
}

export async function reprocessSheet(
  sheetId: string,
  resetMatch = false
): Promise<OmrSheetDetail> {
  const { data } = await apiClient.post<OmrSheetDetail>(
    `/omr/sheets/${sheetId}/reprocess`,
    {},
    { params: { reset_match: resetMatch } }
  );
  return data;
}

export async function deleteSheet(sheetId: string): Promise<void> {
  await apiClient.delete(`/omr/sheets/${sheetId}`);
}

// --- Apply --------------------------------------------------------------------

export interface UnscannedStudent {
  student_id: string;
  full_name: string;
  roll_number: string;
}

export interface SkippedSheet {
  sheet_id: string;
  original_filename: string;
  status: string;
  match_status: string | null;
  detected_roll: string | null;
}

export interface ApplyBatchResult {
  batch: OmrBatch;
  applied_count: number;
  unscanned: UnscannedStudent[];
  skipped: SkippedSheet[];
}

export async function applyBatch(batchId: string): Promise<ApplyBatchResult> {
  const { data } = await apiClient.post<ApplyBatchResult>(`/omr/batches/${batchId}/apply`, {});
  return data;
}

// --- Export -------------------------------------------------------------------

/**
 * Downloads a batch export and hands back a blob.
 *
 * Uses `fetch` rather than `apiClient` on purpose: the shared axios response
 * interceptor unwraps the `{ success, message, data }` envelope, which would
 * reduce a binary body to `undefined`. Credentials are included so the
 * httpOnly auth cookie travels with the request exactly as it does for axios.
 */
export async function downloadBatchExport(
  batchId: string,
  format: "csv" | "excel"
): Promise<{ blob: Blob; filename: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
  const response = await fetch(`${baseUrl}/omr/batches/${batchId}/export?format=${format}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("The export could not be generated. Please try again.");
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  return {
    blob: await response.blob(),
    filename: match?.[1] ?? `omr-export.${format === "csv" ? "csv" : "xlsx"}`,
  };
}
