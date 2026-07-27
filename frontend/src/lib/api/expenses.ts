import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";

export type ExpenseStatus = "pending" | "approved" | "rejected";

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

// --- Expense categories --------------------------------------------------------------

export interface ExpenseCategory {
  id: string;
  name: string;
  created_at: string;
}

export interface CreateExpenseCategoryPayload {
  name: string;
}

export interface UpdateExpenseCategoryPayload {
  name?: string;
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data } = await apiClient.get<ExpenseCategory[]>("/expenses/categories");
  return data;
}

export async function createExpenseCategory(payload: CreateExpenseCategoryPayload): Promise<ExpenseCategory> {
  const { data } = await apiClient.post<ExpenseCategory>("/expenses/categories", payload);
  return data;
}

export async function updateExpenseCategory(
  categoryId: string,
  payload: UpdateExpenseCategoryPayload
): Promise<ExpenseCategory> {
  const { data } = await apiClient.patch<ExpenseCategory>(`/expenses/categories/${categoryId}`, payload);
  return data;
}

export async function deleteExpenseCategory(categoryId: string): Promise<void> {
  await apiClient.delete(`/expenses/categories/${categoryId}`);
}

// --- Expenses --------------------------------------------------------------------------

export interface Expense {
  id: string;
  category_id: string;
  category_name: string;
  amount: number;
  description: string | null;
  expense_date: string;
  requested_by: string;
  requested_by_name: string;
  status: ExpenseStatus;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  is_finalized: boolean;
  created_at: string;
}

export interface CreateExpensePayload {
  category_id: string;
  amount: number;
  description?: string;
  expense_date: string;
}

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const { data } = await apiClient.post<Expense>("/expenses", payload);
  return data;
}

export async function listExpenses(params: {
  status?: ExpenseStatus;
  category_id?: string;
  requested_by?: string;
  page: number;
  limit: number;
}): Promise<{ items: Expense[]; meta: PageMeta }> {
  return getPaginated<Expense>("/expenses", params);
}

export async function getExpense(expenseId: string): Promise<Expense> {
  const { data } = await apiClient.get<Expense>(`/expenses/${expenseId}`);
  return data;
}

export async function approveExpense(expenseId: string): Promise<Expense> {
  const { data } = await apiClient.post<Expense>(`/expenses/${expenseId}/approve`, {});
  return data;
}

export async function rejectExpense(expenseId: string): Promise<Expense> {
  const { data } = await apiClient.post<Expense>(`/expenses/${expenseId}/reject`, {});
  return data;
}
