import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addDiscount,
  cancelInvoice,
  createFeeType,
  deleteFeeStructureItem,
  deleteFeeType,
  generateInvoiceForStudent,
  generateInvoicesForClass,
  getInvoice,
  getMyDues,
  getMyInvoices,
  getReceipt,
  getStudentDues,
  getStudentInvoices,
  listFeeStructures,
  listFeeTypes,
  listInvoices,
  recordPayment,
  setFeeStructure,
  updateFeeType,
  type AddDiscountPayload,
  type CreateFeeTypePayload,
  type GenerateInvoicePayload,
  type InvoiceStatus,
  type RecordPaymentPayload,
  type SetFeeStructurePayload,
  type UpdateFeeTypePayload,
} from "@/lib/api/billing";

// --- Fee types -------------------------------------------------------------------

export const feeTypesQueryKey = ["billing", "fee-types"] as const;

export function useFeeTypesQuery() {
  return useQuery({ queryKey: feeTypesQueryKey, queryFn: listFeeTypes });
}

export function useCreateFeeTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFeeTypePayload) => createFeeType(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feeTypesQueryKey }),
  });
}

export function useUpdateFeeTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ feeTypeId, payload }: { feeTypeId: string; payload: UpdateFeeTypePayload }) =>
      updateFeeType(feeTypeId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feeTypesQueryKey }),
  });
}

export function useDeleteFeeTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feeTypeId: string) => deleteFeeType(feeTypeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feeTypesQueryKey }),
  });
}

// --- Fee structures --------------------------------------------------------------

export const feeStructuresQueryKey = (academicYearId: string, classId?: string) =>
  ["billing", "fee-structures", academicYearId, classId ?? ""] as const;

export function useFeeStructuresQuery(academicYearId: string, classId?: string) {
  return useQuery({
    queryKey: feeStructuresQueryKey(academicYearId, classId),
    queryFn: () => listFeeStructures({ academic_year_id: academicYearId, class_id: classId }),
    enabled: Boolean(academicYearId),
  });
}

export function useSetFeeStructureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetFeeStructurePayload) => setFeeStructure(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing", "fee-structures"] }),
  });
}

export function useDeleteFeeStructureItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (structureId: string) => deleteFeeStructureItem(structureId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing", "fee-structures"] }),
  });
}

// --- Invoice generation -------------------------------------------------------------

export function useGenerateInvoiceForStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, payload }: { studentId: string; payload: GenerateInvoicePayload }) =>
      generateInvoiceForStudent(studentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "dues"] });
    },
  });
}

export function useGenerateInvoicesForClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, payload }: { classId: string; payload: GenerateInvoicePayload }) =>
      generateInvoicesForClass(classId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "dues"] });
    },
  });
}

// --- Invoices ----------------------------------------------------------------------

export const invoicesQueryKey = (params: {
  student_id?: string;
  academic_year_id?: string;
  status?: InvoiceStatus;
  page: number;
  limit: number;
}) => ["billing", "invoices", params] as const;

export function useInvoicesQuery(params: {
  student_id?: string;
  academic_year_id?: string;
  status?: InvoiceStatus;
  page: number;
  limit: number;
}) {
  return useQuery({ queryKey: invoicesQueryKey(params), queryFn: () => listInvoices(params) });
}

export const invoiceQueryKey = (invoiceId: string) => ["billing", "invoice", invoiceId] as const;

export function useInvoiceQuery(invoiceId: string | null) {
  return useQuery({
    queryKey: invoiceQueryKey(invoiceId ?? ""),
    queryFn: () => getInvoice(invoiceId as string),
    enabled: Boolean(invoiceId),
  });
}

function invalidateInvoice(queryClient: ReturnType<typeof useQueryClient>, invoiceId: string) {
  queryClient.invalidateQueries({ queryKey: invoiceQueryKey(invoiceId) });
  queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
  queryClient.invalidateQueries({ queryKey: ["billing", "dues"] });
}

export function useCancelInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => cancelInvoice(invoiceId),
    onSuccess: (_data, invoiceId) => invalidateInvoice(queryClient, invoiceId),
  });
}

export function useAddDiscountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: string; payload: AddDiscountPayload }) =>
      addDiscount(invoiceId, payload),
    onSuccess: (_data, { invoiceId }) => invalidateInvoice(queryClient, invoiceId),
  });
}

export function useRecordPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: string; payload: RecordPaymentPayload }) =>
      recordPayment(invoiceId, payload),
    onSuccess: (_data, { invoiceId }) => invalidateInvoice(queryClient, invoiceId),
  });
}

export const receiptQueryKey = (paymentId: string) => ["billing", "receipt", paymentId] as const;

export function useReceiptQuery(paymentId: string | null) {
  return useQuery({
    queryKey: receiptQueryKey(paymentId ?? ""),
    queryFn: () => getReceipt(paymentId as string),
    enabled: Boolean(paymentId),
  });
}

// --- Dues ------------------------------------------------------------------------

export function useStudentInvoicesQuery(studentId: string | null) {
  return useQuery({
    queryKey: ["billing", "invoices", "by-student", studentId ?? ""],
    queryFn: () => getStudentInvoices(studentId as string),
    enabled: Boolean(studentId),
  });
}

export function useStudentDuesQuery(studentId: string | null) {
  return useQuery({
    queryKey: ["billing", "dues", "student", studentId ?? ""],
    queryFn: () => getStudentDues(studentId as string),
    enabled: Boolean(studentId),
  });
}

export function useMyInvoicesQuery() {
  return useQuery({ queryKey: ["billing", "invoices", "mine"], queryFn: getMyInvoices });
}

export function useMyDuesQuery() {
  return useQuery({ queryKey: ["billing", "dues", "mine"], queryFn: getMyDues });
}
