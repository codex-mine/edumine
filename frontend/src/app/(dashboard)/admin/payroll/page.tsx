"use client";

import { PayrollWorkspace } from "@/components/modules/payroll/payroll-workspace";

export default function AdminPayrollPage() {
  return <PayrollWorkspace runListPath="/admin/payroll/runs" />;
}
