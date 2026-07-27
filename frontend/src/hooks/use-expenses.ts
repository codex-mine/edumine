import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveExpense,
  createExpense,
  createExpenseCategory,
  deleteExpenseCategory,
  getExpense,
  listExpenseCategories,
  listExpenses,
  rejectExpense,
  updateExpenseCategory,
  type CreateExpenseCategoryPayload,
  type CreateExpensePayload,
  type ExpenseStatus,
  type UpdateExpenseCategoryPayload,
} from "@/lib/api/expenses";

// --- Expense categories --------------------------------------------------------------

export const expenseCategoriesQueryKey = ["expenses", "categories"] as const;

export function useExpenseCategoriesQuery() {
  return useQuery({ queryKey: expenseCategoriesQueryKey, queryFn: listExpenseCategories });
}

export function useCreateExpenseCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpenseCategoryPayload) => createExpenseCategory(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expenseCategoriesQueryKey }),
  });
}

export function useUpdateExpenseCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: string; payload: UpdateExpenseCategoryPayload }) =>
      updateExpenseCategory(categoryId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expenseCategoriesQueryKey }),
  });
}

export function useDeleteExpenseCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => deleteExpenseCategory(categoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expenseCategoriesQueryKey }),
  });
}

// --- Expenses --------------------------------------------------------------------------

export const expensesQueryKey = (params: {
  status?: ExpenseStatus;
  category_id?: string;
  requested_by?: string;
  page: number;
  limit: number;
}) => ["expenses", "list", params] as const;

export function useExpensesQuery(params: {
  status?: ExpenseStatus;
  category_id?: string;
  requested_by?: string;
  page: number;
  limit: number;
}) {
  return useQuery({ queryKey: expensesQueryKey(params), queryFn: () => listExpenses(params) });
}

export const expenseQueryKey = (expenseId: string) => ["expenses", "detail", expenseId] as const;

export function useExpenseQuery(expenseId: string | null) {
  return useQuery({
    queryKey: expenseQueryKey(expenseId ?? ""),
    queryFn: () => getExpense(expenseId as string),
    enabled: Boolean(expenseId),
  });
}

function invalidateExpenseQueries(queryClient: ReturnType<typeof useQueryClient>, expenseId?: string) {
  queryClient.invalidateQueries({ queryKey: ["expenses", "list"] });
  if (expenseId) {
    queryClient.invalidateQueries({ queryKey: expenseQueryKey(expenseId) });
  }
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpensePayload) => createExpense(payload),
    onSuccess: () => invalidateExpenseQueries(queryClient),
  });
}

export function useApproveExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => approveExpense(expenseId),
    onSuccess: (_data, expenseId) => invalidateExpenseQueries(queryClient, expenseId),
  });
}

export function useRejectExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => rejectExpense(expenseId),
    onSuccess: (_data, expenseId) => invalidateExpenseQueries(queryClient, expenseId),
  });
}
