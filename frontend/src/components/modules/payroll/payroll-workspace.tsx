"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { GeneratePayrollRunDialog } from "@/components/modules/payroll/generate-payroll-run-dialog";
import { PayrollEmployeesTable } from "@/components/modules/payroll/payroll-employees-table";

export function PayrollWorkspace({ runListPath }: { runListPath: string }) {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">HR &amp; payroll</h1>
        <p className="text-sm text-muted-foreground">
          Set salary structures for teachers and staff, then generate payroll runs per period.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GeneratePayrollRunDialog
          runBasePath={runListPath}
          trigger={
            <Button >
              <Plus className="size-8" aria-hidden="true" />
              Generate payroll run
            </Button>
          }
        />
        <Button asChild size="sm" variant="outline">
          <Link href={runListPath}>View all payroll runs</Link>
        </Button>
      </div>

      <PayrollEmployeesTable />
    </div>
  );
}
