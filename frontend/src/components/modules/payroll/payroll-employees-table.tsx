"use client";

import { useState } from "react";
import { History, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { SalaryHistoryDialog } from "@/components/modules/payroll/salary-history-dialog";
import { SalaryStructureFormDialog } from "@/components/modules/payroll/salary-structure-form-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { usePayrollEmployeesQuery } from "@/hooks/use-payroll";

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PayrollEmployeesTable() {
  const [search, setSearch] = useState("");
  const employeesQuery = usePayrollEmployeesQuery();

  const employees = (employeesQuery.data ?? []).filter(
    (employee) =>
      employee.full_name.toLowerCase().includes(search.toLowerCase()) ||
      employee.employee_code.toLowerCase().includes(search.toLowerCase())
  );

  const rows = employees.map((employee) => ({
    employee: (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{employee.full_name}</span>
        <span className="text-xs text-muted-foreground">
          {employee.employee_code} &middot; {employee.designation ?? employee.role}
        </span>
      </div>
    ),
    type: <Badge variant={employee.employee_type === "teacher" ? "info" : "muted"}>{employee.employee_type}</Badge>,
    salary: employee.current_salary ? (
      <span className="font-medium text-foreground">{formatMoney(employee.current_salary.gross_salary)}</span>
    ) : (
      <Badge variant="warning">Not set</Badge>
    ),
    effective_from: employee.current_salary?.effective_from ?? "—",
    actions: (
      <div className="flex items-center justify-end gap-2">
        <SalaryHistoryDialog
          employee={employee}
          trigger={
            <Button variant="ghost" size="sm">
              <History className="size-4" aria-hidden="true" />
              History
            </Button>
          }
        />
        <SalaryStructureFormDialog
          employee={employee}
          trigger={
            <Button variant="outline" size="sm">
              <Wallet className="size-4" aria-hidden="true" />
              {employee.current_salary ? "Update salary" : "Set salary"}
            </Button>
          }
        />
      </div>
    ),
  }));

  return (
    <DataTable
      title="Teachers & staff"
      description="Current salary structure per active employee. Payroll runs use the structure effective on the run's period."
      columns={[
        { key: "employee", label: "Employee" },
        { key: "type", label: "Type" },
        { key: "salary", label: "Gross salary", align: "right" },
        { key: "effective_from", label: "Effective from" },
        { key: "actions", label: "" },
      ]}
      rows={rows}
      isLoading={employeesQuery.isLoading}
      isError={employeesQuery.isError}
      errorMessage={employeesQuery.error ? loginErrorMessage(employeesQuery.error) : undefined}
      onRetry={() => employeesQuery.refetch()}
      emptyMessage="No active teachers or staff found."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by name or employee code"
      page={1}
      limit={Math.max(rows.length, 1)}
      total={rows.length}
      onPageChange={() => {}}
    />
  );
}
