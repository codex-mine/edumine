"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { ExpenseCategoryFormDialog } from "@/components/modules/expenses/expense-category-form-dialog";
import { ExpensesTable } from "@/components/modules/expenses/expenses-table";
import { RecordExpenseDialog } from "@/components/modules/expenses/record-expense-dialog";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useDeleteExpenseCategoryMutation, useExpenseCategoriesQuery } from "@/hooks/use-expenses";

export function ExpenseWorkspace({ canManageCategories, canApprove }: { canManageCategories: boolean; canApprove: boolean }) {
  const [categorySearch, setCategorySearch] = useState("");
  const categoriesQuery = useExpenseCategoriesQuery();
  const deleteCategoryMutation = useDeleteExpenseCategoryMutation();

  const categories = (categoriesQuery.data ?? []).filter((category) =>
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const categoryRows = categories.map((category) => ({
    name: <span className="font-medium text-foreground">{category.name}</span>,
    edit: canManageCategories ? (
      <ExpenseCategoryFormDialog
        category={category}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ) : null,
    actions: canManageCategories ? (
      <RowActionsMenu
        onSoftDelete={() => deleteCategoryMutation.mutate(category.id)}
        softDeleteDescription="This category is hidden from active lists. Existing expenses referencing it are unaffected."
        isDeleting={deleteCategoryMutation.isPending}
      />
    ) : null,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Expense management</h1>
        <p className="text-sm text-muted-foreground">
          Record institutional expenses and track them through approval before they are finalized.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RecordExpenseDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" aria-hidden="true" />
              Record expense
            </Button>
          }
        />
      </div>

      <DataTable
        title="Expense categories"
        description="Master category list used when recording expenses."
        columns={[
          { key: "name", label: "Category" },
          ...(canManageCategories ? [{ key: "edit", label: "" }, { key: "actions", label: "" }] : []),
        ]}
        rows={categoryRows}
        isLoading={categoriesQuery.isLoading}
        isError={categoriesQuery.isError}
        errorMessage={categoriesQuery.error ? loginErrorMessage(categoriesQuery.error) : undefined}
        onRetry={() => categoriesQuery.refetch()}
        emptyMessage="No expense categories defined yet."
        searchValue={categorySearch}
        onSearchChange={setCategorySearch}
        searchPlaceholder="Search categories"
        page={1}
        limit={Math.max(categoryRows.length, 1)}
        total={categoryRows.length}
        onPageChange={() => {}}
        toolbarActions={
          canManageCategories ? (
            <ExpenseCategoryFormDialog
              trigger={
                <Button size="sm">
                  <Plus className="size-4" aria-hidden="true" />
                  Add category
                </Button>
              }
            />
          ) : undefined
        }
      />

      <ExpensesTable canApprove={canApprove} />
    </div>
  );
}
