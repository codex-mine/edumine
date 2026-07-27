"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { DuesSummaryCard } from "@/components/modules/billing/dues-summary-card";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyDuesQuery, useMyInvoicesQuery } from "@/hooks/use-billing";
import { INVOICE_STATUS_LABELS } from "@/lib/api/billing";

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  paid: "success",
  partially_paid: "info",
  unpaid: "warning",
  overdue: "destructive",
  cancelled: "muted",
};

export default function StudentBillingPage() {
  const duesQuery = useMyDuesQuery();
  const invoicesQuery = useMyInvoicesQuery();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My billing</h1>
        <p className="text-sm text-muted-foreground">Your invoices and outstanding dues.</p>
      </div>

      {duesQuery.isLoading ? (
        <LoadingState label="Loading dues..." />
      ) : duesQuery.isError ? (
        <ErrorState message={loginErrorMessage(duesQuery.error)} onRetry={() => duesQuery.refetch()} />
      ) : duesQuery.data ? (
        <DuesSummaryCard dues={duesQuery.data} invoiceBasePath="/student/billing" />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>All invoices</CardTitle>
          <CardDescription>Full invoice history, including settled invoices.</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          {invoicesQuery.isLoading ? (
            <LoadingState label="Loading invoices..." />
          ) : invoicesQuery.isError ? (
            <ErrorState message={loginErrorMessage(invoicesQuery.error)} onRetry={() => invoicesQuery.refetch()} />
          ) : (invoicesQuery.data ?? []).length === 0 ? (
            <EmptyState message="No invoices yet." />
          ) : (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Invoice</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Due date</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(invoicesQuery.data ?? []).map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2">
                        <Link href={`/student/billing/${invoice.id}`} className="font-medium text-primary hover:underline">
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{invoice.due_date}</td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_BADGE_VARIANT[invoice.status] ?? "muted"}>
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{invoice.total_amount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{invoice.due_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
