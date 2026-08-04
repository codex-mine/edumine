import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyBatch,
  createBatch,
  deleteAnswerKey,
  deleteBatch,
  deleteSheet,
  getBatch,
  getEligibility,
  getSheet,
  listAnswerKeys,
  listBatches,
  listSheets,
  patchSheet,
  reprocessSheet,
  saveAnswerKey,
  uploadSheets,
  type BatchStatus,
  type MatchStatus,
  type PatchSheetPayload,
  type SaveAnswerKeyPayload,
  type SheetStatus,
} from "@/lib/api/omr";

// --- Eligibility --------------------------------------------------------------

export const eligibilityQueryKey = (examSubjectId: string) =>
  ["omr", "eligibility", examSubjectId] as const;

export function useEligibilityQuery(examSubjectId: string) {
  return useQuery({
    queryKey: eligibilityQueryKey(examSubjectId),
    queryFn: () => getEligibility(examSubjectId),
    enabled: Boolean(examSubjectId),
  });
}

/** Resolves eligibility for several exam subjects at once, so the batch-create
 * picker can grey out the ones that cannot be scanned and explain why. */
export function useEligibilityQueries(examSubjectIds: string[]) {
  return useQueries({
    queries: examSubjectIds.map((examSubjectId) => ({
      queryKey: eligibilityQueryKey(examSubjectId),
      queryFn: () => getEligibility(examSubjectId),
    })),
  });
}

// --- Answer keys --------------------------------------------------------------

export const answerKeysQueryKey = (examSubjectId: string) =>
  ["omr", "answer-keys", examSubjectId] as const;

export function useAnswerKeysQuery(examSubjectId: string) {
  return useQuery({
    queryKey: answerKeysQueryKey(examSubjectId),
    queryFn: () => listAnswerKeys(examSubjectId),
    enabled: Boolean(examSubjectId),
  });
}

export function useSaveAnswerKeyMutation(examSubjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ setCode, payload }: { setCode: string; payload: SaveAnswerKeyPayload }) =>
      saveAnswerKey(examSubjectId, setCode, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: answerKeysQueryKey(examSubjectId) });
      queryClient.invalidateQueries({ queryKey: eligibilityQueryKey(examSubjectId) });
    },
  });
}

export function useDeleteAnswerKeyMutation(examSubjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answerKeyId: string) => deleteAnswerKey(answerKeyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: answerKeysQueryKey(examSubjectId) });
      queryClient.invalidateQueries({ queryKey: eligibilityQueryKey(examSubjectId) });
    },
  });
}

// --- Batches ------------------------------------------------------------------

export const batchesQueryKey = (examSubjectId?: string, status?: BatchStatus) =>
  ["omr", "batches", examSubjectId ?? "all", status ?? "any"] as const;

export function useBatchesQuery(params?: { examSubjectId?: string; status?: BatchStatus }) {
  return useQuery({
    queryKey: batchesQueryKey(params?.examSubjectId, params?.status),
    queryFn: () =>
      listBatches({ exam_subject_id: params?.examSubjectId, status: params?.status }),
  });
}

export const batchQueryKey = (batchId: string) => ["omr", "batch", batchId] as const;

export function useBatchQuery(batchId: string) {
  return useQuery({
    queryKey: batchQueryKey(batchId),
    queryFn: () => getBatch(batchId),
    enabled: Boolean(batchId),
  });
}

export function useCreateBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examSubjectId, name }: { examSubjectId: string; name: string }) =>
      createBatch(examSubjectId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["omr", "batches"] }),
  });
}

export function useDeleteBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => deleteBatch(batchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["omr", "batches"] }),
  });
}

// --- Sheets -------------------------------------------------------------------

export const sheetsQueryKey = (batchId: string, status?: SheetStatus, matchStatus?: MatchStatus) =>
  ["omr", "sheets", batchId, status ?? "any", matchStatus ?? "any"] as const;

export function useSheetsQuery(
  batchId: string,
  params?: { status?: SheetStatus; matchStatus?: MatchStatus }
) {
  return useQuery({
    queryKey: sheetsQueryKey(batchId, params?.status, params?.matchStatus),
    queryFn: () => listSheets(batchId, { status: params?.status, match_status: params?.matchStatus }),
    enabled: Boolean(batchId),
  });
}

export const sheetQueryKey = (sheetId: string) => ["omr", "sheet", sheetId] as const;

export function useSheetQuery(sheetId: string | null) {
  return useQuery({
    queryKey: sheetQueryKey(sheetId ?? ""),
    queryFn: () => getSheet(sheetId!),
    enabled: Boolean(sheetId),
  });
}

/** Every sheet mutation can change the batch's counters and its status, so all
 * of them invalidate the batch alongside the sheet lists. */
function useSheetMutationInvalidation(batchId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["omr", "sheets", batchId] });
    queryClient.invalidateQueries({ queryKey: batchQueryKey(batchId) });
    queryClient.invalidateQueries({ queryKey: ["omr", "batches"] });
  };
}

export function useUploadSheetsMutation(batchId: string) {
  const invalidate = useSheetMutationInvalidation(batchId);
  return useMutation({
    mutationFn: ({ files, onProgress }: { files: File[]; onProgress?: (p: number) => void }) =>
      uploadSheets(batchId, files, onProgress),
    onSuccess: invalidate,
  });
}

export function usePatchSheetMutation(batchId: string) {
  const queryClient = useQueryClient();
  const invalidate = useSheetMutationInvalidation(batchId);
  return useMutation({
    mutationFn: ({ sheetId, payload }: { sheetId: string; payload: PatchSheetPayload }) =>
      patchSheet(sheetId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: sheetQueryKey(variables.sheetId) });
      invalidate();
    },
  });
}

export function useReprocessSheetMutation(batchId: string) {
  const queryClient = useQueryClient();
  const invalidate = useSheetMutationInvalidation(batchId);
  return useMutation({
    mutationFn: ({ sheetId, resetMatch }: { sheetId: string; resetMatch?: boolean }) =>
      reprocessSheet(sheetId, resetMatch ?? false),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: sheetQueryKey(variables.sheetId) });
      invalidate();
    },
  });
}

export function useDeleteSheetMutation(batchId: string) {
  const invalidate = useSheetMutationInvalidation(batchId);
  return useMutation({
    mutationFn: (sheetId: string) => deleteSheet(sheetId),
    onSuccess: invalidate,
  });
}

// --- Apply --------------------------------------------------------------------

export function useApplyBatchMutation(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => applyBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: batchQueryKey(batchId) });
      queryClient.invalidateQueries({ queryKey: ["omr", "sheets", batchId] });
      queryClient.invalidateQueries({ queryKey: ["omr", "batches"] });
      // The marks roster now carries the scanned results.
      queryClient.invalidateQueries({ queryKey: ["results"] });
    },
  });
}
