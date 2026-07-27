"use client";

import { useState } from "react";
import { History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useDeleteSalaryStructureMutation, useSalaryStructuresQuery } from "@/hooks/use-payroll";
import type { PayrollEmployee } from "@/lib/api/payroll";

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SalaryHistoryDialog({ trigger, employee }: { trigger: React.ReactNode; employee: PayrollEmployee }) {
  const [open, setOpen] = useState(false);
  const historyQuery = useSalaryStructuresQuery({
    teacher_id: employee.teacher_id ?? undefined,
    staff_id: employee.staff_id ?? undefined,
  });
  const deleteMutation = useDeleteSalaryStructureMutation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" aria-hidden="true" />
            Salary history — {employee.full_name}
          </DialogTitle>
          <DialogDescription>{employee.employee_code}</DialogDescription>
        </DialogHeader>

        {historyQuery.isLoading ? (
          <LoadingState label="Loading salary history..." />
        ) : historyQuery.isError ? (
          <ErrorState message={loginErrorMessage(historyQuery.error)} onRetry={() => historyQuery.refetch()} />
        ) : (historyQuery.data ?? []).length === 0 ? (
          <EmptyState message="No salary structure has been set for this employee yet." />
        ) : (
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {(historyQuery.data ?? []).map((structure) => (
              <div
                key={structure.id}
                className="flex items-center justify-between gap-3 rounded border border-border p-3 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">Effective {structure.effective_from}</span>
                  <span className="text-xs text-muted-foreground">
                    Basic {formatMoney(structure.basic_salary)} &middot; Allowances {formatMoney(structure.allowances)}
                    &middot; Deductions {formatMoney(structure.deductions)}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    Gross {formatMoney(structure.gross_salary)}
                  </span>
                </div>
                <RowActionsMenu
                  onSoftDelete={() => deleteMutation.mutate(structure.id)}
                  softDeleteLabel="Remove"
                  softDeleteDescription="This salary structure entry will be permanently removed. Payslips already generated from it are unaffected."
                  isDeleting={deleteMutation.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
