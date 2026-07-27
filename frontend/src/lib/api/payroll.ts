import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";

export type PayrollStatus = "draft" | "processed" | "paid";
export type PayslipStatus = "pending" | "paid";
export type EmployeeType = "teacher" | "staff";

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: "Draft",
  processed: "Processed",
  paid: "Paid",
};

export const PAYSLIP_STATUS_LABELS: Record<PayslipStatus, string> = {
  pending: "Pending",
  paid: "Paid",
};

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// --- Salary structures -------------------------------------------------------------

export interface SalaryStructure {
  id: string;
  teacher_id: string | null;
  staff_id: string | null;
  employee_type: EmployeeType;
  employee_name: string;
  employee_code: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  gross_salary: number;
  effective_from: string;
  created_at: string;
}

export interface SetSalaryStructurePayload {
  teacher_id?: string;
  staff_id?: string;
  basic_salary: number;
  allowances?: number;
  deductions?: number;
  effective_from: string;
}

export interface UpdateSalaryStructurePayload {
  basic_salary?: number;
  allowances?: number;
  deductions?: number;
  effective_from?: string;
}

export async function createSalaryStructure(payload: SetSalaryStructurePayload): Promise<SalaryStructure> {
  const { data } = await apiClient.post<SalaryStructure>("/payroll/salary-structures", payload);
  return data;
}

export async function updateSalaryStructure(
  structureId: string,
  payload: UpdateSalaryStructurePayload
): Promise<SalaryStructure> {
  const { data } = await apiClient.patch<SalaryStructure>(`/payroll/salary-structures/${structureId}`, payload);
  return data;
}

export async function deleteSalaryStructure(structureId: string): Promise<void> {
  await apiClient.delete(`/payroll/salary-structures/${structureId}`);
}

export async function listSalaryStructures(params: {
  teacher_id?: string;
  staff_id?: string;
}): Promise<SalaryStructure[]> {
  const { data } = await apiClient.get<SalaryStructure[]>("/payroll/salary-structures", { params });
  return data;
}

export async function getCurrentSalaryStructure(params: {
  teacher_id?: string;
  staff_id?: string;
}): Promise<SalaryStructure | null> {
  const { data } = await apiClient.get<SalaryStructure | null>("/payroll/salary-structures/current", { params });
  return data;
}

// --- Employees -----------------------------------------------------------------------

export interface PayrollEmployee {
  employee_type: EmployeeType;
  teacher_id: string | null;
  staff_id: string | null;
  full_name: string;
  employee_code: string;
  designation: string | null;
  role: string;
  status: string;
  current_salary: SalaryStructure | null;
}

export async function listPayrollEmployees(): Promise<PayrollEmployee[]> {
  const { data } = await apiClient.get<PayrollEmployee[]>("/payroll/employees");
  return data;
}

// --- Payslips --------------------------------------------------------------------------

export interface Payslip {
  id: string;
  payroll_run_id: string;
  teacher_id: string | null;
  staff_id: string | null;
  employee_type: EmployeeType;
  employee_name: string;
  employee_code: string;
  gross_amount: number;
  deductions: number;
  net_amount: number;
  status: PayslipStatus;
  paid_at: string | null;
  created_at: string;
}

export async function listPayslips(params: {
  payroll_run_id?: string;
  teacher_id?: string;
  staff_id?: string;
  status?: PayslipStatus;
  page: number;
  limit: number;
}): Promise<{ items: Payslip[]; meta: PageMeta }> {
  return getPaginated<Payslip>("/payroll/payslips", params);
}

export async function getPayslip(payslipId: string): Promise<Payslip> {
  const { data } = await apiClient.get<Payslip>(`/payroll/payslips/${payslipId}`);
  return data;
}

export async function markPayslipPaid(payslipId: string): Promise<Payslip> {
  const { data } = await apiClient.post<Payslip>(`/payroll/payslips/${payslipId}/mark-paid`, {});
  return data;
}

// --- Payroll runs ----------------------------------------------------------------------

export interface SkippedEmployee {
  employee_type: EmployeeType;
  teacher_id: string | null;
  staff_id: string | null;
  full_name: string;
}

export interface PayrollRunSummary {
  id: string;
  period_month: number;
  period_year: number;
  status: PayrollStatus;
  generated_by: string;
  generated_by_name: string;
  payslip_count: number;
  total_net_amount: number;
  created_at: string;
}

export interface PayrollRunDetail extends PayrollRunSummary {
  payslips: Payslip[];
  skipped?: SkippedEmployee[];
}

export interface GeneratePayrollRunPayload {
  period_month: number;
  period_year: number;
}

export async function generatePayrollRun(payload: GeneratePayrollRunPayload): Promise<PayrollRunDetail> {
  const { data } = await apiClient.post<PayrollRunDetail>("/payroll/runs", payload);
  return data;
}

export async function listPayrollRuns(params: {
  status?: PayrollStatus;
  period_year?: number;
  page: number;
  limit: number;
}): Promise<{ items: PayrollRunSummary[]; meta: PageMeta }> {
  return getPaginated<PayrollRunSummary>("/payroll/runs", params);
}

export async function getPayrollRun(runId: string): Promise<PayrollRunDetail> {
  const { data } = await apiClient.get<PayrollRunDetail>(`/payroll/runs/${runId}`);
  return data;
}
