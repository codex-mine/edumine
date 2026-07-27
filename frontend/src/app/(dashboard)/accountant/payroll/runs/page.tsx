"use client";

import { PayrollRunListTable } from "@/components/modules/payroll/payroll-run-list-table";

export default function AccountantPayrollRunsPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Payroll runs</h1>
        <p className="text-sm text-muted-foreground">All generated payroll runs, across periods.</p>
      </div>
      <PayrollRunListTable runBasePath="/accountant/payroll/runs" />
    </div>
  );
}
