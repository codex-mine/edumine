"use client";

import { ExpenseWorkspace } from "@/components/modules/expenses/expense-workspace";
import { useAuth } from "@/providers/auth-provider";

export default function AdminExpensesPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  return (
    <ExpenseWorkspace
      canManageCategories={permissions.includes("expenses.approve")}
      canApprove={permissions.includes("expenses.approve")}
    />
  );
}
