import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";

export type InvoiceStatus = "unpaid" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type DiscountType = "flat" | "percentage";
export type PaymentMethod = "cash" | "online" | "bank_transfer" | "cheque";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
];

// --- Fee types -------------------------------------------------------------------

export interface FeeType {
  id: string;
  name: string;
  is_recurring: boolean;
}

export interface CreateFeeTypePayload {
  name: string;
  is_recurring: boolean;
}

export interface UpdateFeeTypePayload {
  name?: string;
  is_recurring?: boolean;
}

export async function listFeeTypes(): Promise<FeeType[]> {
  const { data } = await apiClient.get<FeeType[]>("/billing/fee-types");
  return data;
}

export async function createFeeType(payload: CreateFeeTypePayload): Promise<FeeType> {
  const { data } = await apiClient.post<FeeType>("/billing/fee-types", payload);
  return data;
}

export async function updateFeeType(feeTypeId: string, payload: UpdateFeeTypePayload): Promise<FeeType> {
  const { data } = await apiClient.patch<FeeType>(`/billing/fee-types/${feeTypeId}`, payload);
  return data;
}

export async function deleteFeeType(feeTypeId: string): Promise<void> {
  await apiClient.delete(`/billing/fee-types/${feeTypeId}`);
}

// --- Class fee structures --------------------------------------------------------

export interface FeeStructureItem {
  id: string;
  academic_year_id: string;
  class_id: string;
  class_name: string;
  fee_type_id: string;
  fee_type_name: string;
  is_recurring: boolean;
  amount: number;
}

export interface SetFeeStructurePayload {
  academic_year_id: string;
  class_id: string;
  items: { fee_type_id: string; amount: number }[];
}

export async function listFeeStructures(params: {
  academic_year_id: string;
  class_id?: string;
}): Promise<FeeStructureItem[]> {
  const { data } = await apiClient.get<FeeStructureItem[]>("/billing/fee-structures", { params });
  return data;
}

export async function setFeeStructure(payload: SetFeeStructurePayload): Promise<FeeStructureItem[]> {
  const { data } = await apiClient.put<FeeStructureItem[]>("/billing/fee-structures", payload);
  return data;
}

export async function deleteFeeStructureItem(structureId: string): Promise<void> {
  await apiClient.delete(`/billing/fee-structures/${structureId}`);
}

// --- Invoices ----------------------------------------------------------------------

export interface InvoiceItemLine {
  id: string;
  fee_type_id: string;
  fee_type_name: string;
  description: string | null;
  amount: number;
}

export interface InvoiceDiscount {
  id: string;
  discount_type: DiscountType;
  value: number;
  amount: number;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  transaction_reference: string | null;
  received_by: string;
  received_by_name: string;
  paid_at: string;
}

export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  academic_year_id: string;
  subtotal: number;
  discount_total: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: InvoiceStatus;
  due_date: string;
  created_at: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  issued_by: string;
  items: InvoiceItemLine[];
  discounts: InvoiceDiscount[];
  payments: InvoicePayment[];
}

export interface GenerateInvoicePayload {
  fee_type_ids: string[];
  due_date: string;
  academic_year_id?: string;
}

export interface GenerateInvoicesForClassResult {
  class_id: string;
  class_name: string;
  created: InvoiceDetail[];
  skipped_student_ids: string[];
}

export async function generateInvoiceForStudent(
  studentId: string,
  payload: GenerateInvoicePayload
): Promise<InvoiceDetail> {
  const { data } = await apiClient.post<InvoiceDetail>(`/billing/students/${studentId}/invoices`, payload);
  return data;
}

export async function generateInvoicesForClass(
  classId: string,
  payload: GenerateInvoicePayload
): Promise<GenerateInvoicesForClassResult> {
  const { data } = await apiClient.post<GenerateInvoicesForClassResult>(
    `/billing/classes/${classId}/invoices/generate`,
    payload
  );
  return data;
}

export async function listInvoices(params: {
  student_id?: string;
  academic_year_id?: string;
  status?: InvoiceStatus;
  page: number;
  limit: number;
}): Promise<{ items: InvoiceSummary[]; meta: PageMeta }> {
  return getPaginated<InvoiceSummary>("/billing/invoices", params);
}

export async function getInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const { data } = await apiClient.get<InvoiceDetail>(`/billing/invoices/${invoiceId}`);
  return data;
}

export async function cancelInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const { data } = await apiClient.post<InvoiceDetail>(`/billing/invoices/${invoiceId}/cancel`, {});
  return data;
}

export interface AddDiscountPayload {
  discount_type: DiscountType;
  value: number;
  reason?: string;
}

export async function addDiscount(invoiceId: string, payload: AddDiscountPayload): Promise<InvoiceDetail> {
  const { data } = await apiClient.post<InvoiceDetail>(`/billing/invoices/${invoiceId}/discounts`, payload);
  return data;
}

export interface RecordPaymentPayload {
  amount: number;
  method: PaymentMethod;
  transaction_reference?: string;
}

export interface RecordPaymentResult {
  payment_id: string;
  invoice: InvoiceDetail;
}

export async function recordPayment(
  invoiceId: string,
  payload: RecordPaymentPayload
): Promise<RecordPaymentResult> {
  const { data } = await apiClient.post<RecordPaymentResult>(`/billing/invoices/${invoiceId}/payments`, payload);
  return data;
}

export interface Receipt {
  payment: InvoicePayment;
  invoice: InvoiceDetail;
}

export async function getReceipt(paymentId: string): Promise<Receipt> {
  const { data } = await apiClient.get<Receipt>(`/billing/payments/${paymentId}/receipt`);
  return data;
}

// --- Dues ------------------------------------------------------------------------

export interface DuesSummary {
  student_id: string;
  student_name: string;
  admission_number: string;
  total_due: number;
  outstanding_invoices: InvoiceSummary[];
}

export async function getStudentInvoices(studentId: string): Promise<InvoiceSummary[]> {
  const { data } = await apiClient.get<InvoiceSummary[]>(`/billing/students/${studentId}/invoices`);
  return data;
}

export async function getStudentDues(studentId: string): Promise<DuesSummary> {
  const { data } = await apiClient.get<DuesSummary>(`/billing/students/${studentId}/dues`);
  return data;
}

export async function getMyInvoices(): Promise<InvoiceSummary[]> {
  const { data } = await apiClient.get<InvoiceSummary[]>("/billing/my/invoices");
  return data;
}

export async function getMyDues(): Promise<DuesSummary> {
  const { data } = await apiClient.get<DuesSummary>("/billing/my/dues");
  return data;
}
