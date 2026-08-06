"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import {
  DetailSection,
  SimpleTable,
  StatGrid,
  StatTile,
} from "@/components/modules/people/detail/detail-shell";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useCurrentSalaryStructureQuery, usePayslipsQuery } from "@/hooks/use-payroll";
import type { PayslipStatus } from "@/lib/api/payroll";

const STATUS_VARIANT: Record<PayslipStatus, "success" | "warning"> = {
  paid: "success",
  pending: "warning",
};

const currency = (amount: number) => `৳${amount.toLocaleString()}`;

/** Payslip history for one employee. Exactly one of `teacherId` / `staffId` is
 * set — payroll keys teachers and staff separately. */
export function PayrollPanel({
  teacherId,
  staffId,
}: {
  teacherId?: string;
  staffId?: string;
}) {
  const employee = { teacher_id: teacherId, staff_id: staffId };
  const payslipsQuery = usePayslipsQuery({ ...employee, page: 1, limit: 50 });
  const structureQuery = useCurrentSalaryStructureQuery(employee);

  const payslips = payslipsQuery.data?.items ?? [];
  const totalPaid = payslips
    .filter((payslip) => payslip.status === "paid")
    .reduce((sum, payslip) => sum + payslip.net_amount, 0);
  const pending = payslips.filter((payslip) => payslip.status !== "paid").length;
  const structure = structureQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile label="Current gross" value={structure ? currency(structure.gross_salary) : "—"} />
        <StatTile label="Payslips" value={payslipsQuery.data?.meta.total ?? 0} />
        <StatTile label="Paid to date" value={currency(totalPaid)} tone="positive" />
        <StatTile label="Awaiting payment" value={pending} tone={pending > 0 ? "warning" : "positive"} />
      </StatGrid>

      <DetailSection title="Payslips" description="Payroll history for this employee, newest first.">
        {payslipsQuery.isPending ? (
          <LoadingState label="Loading payslips..." />
        ) : payslipsQuery.isError ? (
          <ErrorState message={loginErrorMessage(payslipsQuery.error)} onRetry={() => payslipsQuery.refetch()} />
        ) : payslips.length === 0 ? (
          <EmptyState message="No payslips generated yet." />
        ) : (
          <SimpleTable
            headers={["Generated", "Gross", "Deductions", "Net", "Status", "Paid on"]}
            rows={payslips.map((payslip) => [
              new Date(payslip.created_at).toLocaleDateString(),
              currency(payslip.gross_amount),
              currency(payslip.deductions),
              currency(payslip.net_amount),
              <Badge key={payslip.id} variant={STATUS_VARIANT[payslip.status] ?? "muted"}>
                {payslip.status}
              </Badge>,
              payslip.paid_at ? new Date(payslip.paid_at).toLocaleDateString() : "—",
            ])}
          />
        )}
      </DetailSection>
    </div>
  );
}
