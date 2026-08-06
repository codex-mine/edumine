"use client";

import Link from "next/link";

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
import { useStudentDuesQuery, useStudentInvoicesQuery } from "@/hooks/use-billing";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/api/billing";

const STATUS_VARIANT: Record<InvoiceStatus, "success" | "warning" | "destructive" | "muted"> = {
  paid: "success",
  partially_paid: "warning",
  unpaid: "warning",
  overdue: "destructive",
  cancelled: "muted",
};

const currency = (amount: number) => `৳${amount.toLocaleString()}`;

export function StudentBillingPanel({
  studentId,
  academicYearId,
  yearLabel,
}: {
  studentId: string;
  academicYearId?: string;
  yearLabel?: string;
}) {
  const invoicesQuery = useStudentInvoicesQuery(studentId);
  const duesQuery = useStudentDuesQuery(studentId);

  // The endpoint returns every invoice for the student; invoices carry their own
  // academic year, so scoping to the selected year happens here.
  const invoices = (invoicesQuery.data ?? []).filter(
    (invoice) => !academicYearId || invoice.academic_year_id === academicYearId
  );

  const billed = invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const paid = invoices.reduce((sum, invoice) => sum + invoice.paid_amount, 0);
  const due = invoices.reduce((sum, invoice) => sum + invoice.due_amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile label="Billed" value={currency(billed)} hint={yearLabel} />
        <StatTile label="Collected" value={currency(paid)} tone="positive" />
        <StatTile label="Due this year" value={currency(due)} tone={due > 0 ? "negative" : "positive"} />
        <StatTile
          label="Total outstanding"
          value={duesQuery.data ? currency(duesQuery.data.total_due) : "—"}
          hint="all years"
          tone={duesQuery.data && duesQuery.data.total_due > 0 ? "negative" : "positive"}
        />
      </StatGrid>

      <DetailSection
        title="Invoices"
        description={yearLabel ? `Fee invoices raised for ${yearLabel}.` : "Fee invoices raised for this student."}
      >
        {invoicesQuery.isPending ? (
          <LoadingState label="Loading invoices..." />
        ) : invoicesQuery.isError ? (
          <ErrorState message={loginErrorMessage(invoicesQuery.error)} onRetry={() => invoicesQuery.refetch()} />
        ) : invoices.length === 0 ? (
          <EmptyState message="No invoices for this academic year." />
        ) : (
          <SimpleTable
            headers={["Invoice #", "Issued", "Due date", "Total", "Paid", "Due", "Status"]}
            rows={invoices.map((invoice) => [
              <Link
                key={invoice.id}
                href={`/admin/billing/invoices/${invoice.id}`}
                className="font-medium text-primary hover:underline"
              >
                {invoice.invoice_number}
              </Link>,
              new Date(invoice.created_at).toLocaleDateString(),
              new Date(invoice.due_date).toLocaleDateString(),
              currency(invoice.total_amount),
              currency(invoice.paid_amount),
              currency(invoice.due_amount),
              <Badge key={`${invoice.id}-status`} variant={STATUS_VARIANT[invoice.status] ?? "muted"}>
                {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
              </Badge>,
            ])}
          />
        )}
      </DetailSection>
    </div>
  );
}
