import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSalaryStructure,
  deleteSalaryStructure,
  generatePayrollRun,
  getCurrentSalaryStructure,
  getPayrollRun,
  getPayslip,
  listPayrollEmployees,
  listPayrollRuns,
  listPayslips,
  listSalaryStructures,
  markPayslipPaid,
  updateSalaryStructure,
  type GeneratePayrollRunPayload,
  type PayrollStatus,
  type PayslipStatus,
  type SetSalaryStructurePayload,
  type UpdateSalaryStructurePayload,
} from "@/lib/api/payroll";

// --- Employees ------------------------------------------------------------------------

export const payrollEmployeesQueryKey = ["payroll", "employees"] as const;

export function usePayrollEmployeesQuery() {
  return useQuery({ queryKey: payrollEmployeesQueryKey, queryFn: listPayrollEmployees });
}

// --- Salary structures -----------------------------------------------------------------

export const salaryStructuresQueryKey = (employee: { teacher_id?: string; staff_id?: string }) =>
  ["payroll", "salary-structures", employee.teacher_id ?? "", employee.staff_id ?? ""] as const;

export function useSalaryStructuresQuery(employee: { teacher_id?: string; staff_id?: string }) {
  return useQuery({
    queryKey: salaryStructuresQueryKey(employee),
    queryFn: () => listSalaryStructures(employee),
    enabled: Boolean(employee.teacher_id || employee.staff_id),
  });
}

export const currentSalaryStructureQueryKey = (employee: { teacher_id?: string; staff_id?: string }) =>
  ["payroll", "salary-structures", "current", employee.teacher_id ?? "", employee.staff_id ?? ""] as const;

export function useCurrentSalaryStructureQuery(employee: { teacher_id?: string; staff_id?: string }) {
  return useQuery({
    queryKey: currentSalaryStructureQueryKey(employee),
    queryFn: () => getCurrentSalaryStructure(employee),
    enabled: Boolean(employee.teacher_id || employee.staff_id),
  });
}

function invalidateSalaryQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["payroll", "salary-structures"] });
  queryClient.invalidateQueries({ queryKey: payrollEmployeesQueryKey });
}

export function useCreateSalaryStructureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetSalaryStructurePayload) => createSalaryStructure(payload),
    onSuccess: () => invalidateSalaryQueries(queryClient),
  });
}

export function useUpdateSalaryStructureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ structureId, payload }: { structureId: string; payload: UpdateSalaryStructurePayload }) =>
      updateSalaryStructure(structureId, payload),
    onSuccess: () => invalidateSalaryQueries(queryClient),
  });
}

export function useDeleteSalaryStructureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (structureId: string) => deleteSalaryStructure(structureId),
    onSuccess: () => invalidateSalaryQueries(queryClient),
  });
}

// --- Payroll runs ------------------------------------------------------------------------

export const payrollRunsQueryKey = (params: { status?: PayrollStatus; period_year?: number; page: number; limit: number }) =>
  ["payroll", "runs", params] as const;

export function usePayrollRunsQuery(params: { status?: PayrollStatus; period_year?: number; page: number; limit: number }) {
  return useQuery({ queryKey: payrollRunsQueryKey(params), queryFn: () => listPayrollRuns(params) });
}

export const payrollRunQueryKey = (runId: string) => ["payroll", "run", runId] as const;

export function usePayrollRunQuery(runId: string | null) {
  return useQuery({
    queryKey: payrollRunQueryKey(runId ?? ""),
    queryFn: () => getPayrollRun(runId as string),
    enabled: Boolean(runId),
  });
}

export function useGeneratePayrollRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GeneratePayrollRunPayload) => generatePayrollRun(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", "runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll", "payslips"] });
    },
  });
}

// --- Payslips ---------------------------------------------------------------------------

export const payslipsQueryKey = (params: {
  payroll_run_id?: string;
  teacher_id?: string;
  staff_id?: string;
  status?: PayslipStatus;
  page: number;
  limit: number;
}) => ["payroll", "payslips", params] as const;

export function usePayslipsQuery(params: {
  payroll_run_id?: string;
  teacher_id?: string;
  staff_id?: string;
  status?: PayslipStatus;
  page: number;
  limit: number;
}) {
  return useQuery({ queryKey: payslipsQueryKey(params), queryFn: () => listPayslips(params) });
}

export const payslipQueryKey = (payslipId: string) => ["payroll", "payslip", payslipId] as const;

export function usePayslipQuery(payslipId: string | null) {
  return useQuery({
    queryKey: payslipQueryKey(payslipId ?? ""),
    queryFn: () => getPayslip(payslipId as string),
    enabled: Boolean(payslipId),
  });
}

export function useMarkPayslipPaidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payslipId: string) => markPayslipPaid(payslipId),
    onSuccess: (_data, payslipId) => {
      queryClient.invalidateQueries({ queryKey: payslipQueryKey(payslipId) });
      queryClient.invalidateQueries({ queryKey: ["payroll", "payslips"] });
      queryClient.invalidateQueries({ queryKey: ["payroll", "runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll", "run"] });
    },
  });
}
