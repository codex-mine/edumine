"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useApproveExpenseMutation, useExpensesQuery, useRejectExpenseMutation } from "@/hooks/use-expenses";
import { EXPENSE_STATUS_LABELS, type ExpenseStatus } from "@/lib/api/expenses";

const STATUS_BADGE_VARIANT: Record<ExpenseStatus, "success" | "warning" | "destructive"> = {
  approved: "success",
  pending: "warning",
  rejected: "destructive",
};

const STATUS_OPTIONS: ExpenseStatus[] = ["pending", "approved", "rejected"];

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ExpensesTable({ canApprove }: { canApprove: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ExpenseStatus | "all">("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const expensesQuery = useExpensesQuery({ status: status === "all" ? undefined : status, page, limit });
  const approveMutation = useApproveExpenseMutation();
  const rejectMutation = useRejectExpenseMutation();

  const allItems = expensesQuery.data?.items ?? [];
  const items = search
    ? allItems.filter(
        (expense) =>
          expense.requested_by_name.toLowerCase().includes(search.toLowerCase()) ||
          expense.category_name.toLowerCase().includes(search.toLowerCase())
      )
    : allItems;

  const rows = items.map((expense) => ({
    date: expense.expense_date,
    category: <span className="font-medium text-foreground">{expense.category_name}</span>,
    amount: formatMoney(expense.amount),
    requested_by: expense.requested_by_name,
    status: <Badge variant={STATUS_BADGE_VARIANT[expense.status]}>{EXPENSE_STATUS_LABELS[expense.status]}</Badge>,
    trail: expense.approved_by_name ? (
      <span className="text-muted-foreground">
        {EXPENSE_STATUS_LABELS[expense.status]} by {expense.approved_by_name}
        {expense.approved_at && <> &middot; {formatDateTime(expense.approved_at)}</>}
      </span>
    ) : (
      <span className="text-muted-foreground">Awaiting decision</span>
    ),
    actions:
      canApprove && expense.status === "pending" ? (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate(expense.id)}
          >
            <Check className="size-4" aria-hidden="true" />
            Approve
          </Button>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="outline" disabled={rejectMutation.isPending}>
                <X className="size-4" aria-hidden="true" />
                Reject
              </Button>
            }
            title="Reject this expense?"
            description={`${expense.category_name} — ${formatMoney(expense.amount)}, requested by ${expense.requested_by_name}. This expense will not be finalized.`}
            confirmLabel="Reject"
            onConfirm={() => rejectMutation.mutate(expense.id)}
            isPending={rejectMutation.isPending}
          />
        </div>
      ) : null,
  }));

  return (
    <DataTable
      title="Expenses"
      description="Recorded institutional expenses and their approval trail."
      columns={[
        { key: "date", label: "Date" },
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "requested_by", label: "Requested by" },
        { key: "status", label: "Status" },
        { key: "trail", label: "Approval trail" },
        ...(canApprove ? [{ key: "actions", label: "" }] : []),
      ]}
      rows={rows}
      isLoading={expensesQuery.isLoading}
      isError={expensesQuery.isError}
      errorMessage={expensesQuery.error ? loginErrorMessage(expensesQuery.error) : undefined}
      onRetry={() => expensesQuery.refetch()}
      emptyMessage="No expenses recorded yet."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by requester or category"
      page={page}
      limit={limit}
      total={expensesQuery.data?.meta.total ?? 0}
      onPageChange={setPage}
      toolbarActions={
        <Select value={status} onValueChange={(value) => setStatus(value as ExpenseStatus | "all")}>
          <SelectTrigger className="w-[10rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {EXPENSE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
