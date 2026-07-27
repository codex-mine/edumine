"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { INVOICE_STATUS_LABELS, type DuesSummary } from "@/lib/api/billing";

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  paid: "success",
  partially_paid: "info",
  unpaid: "warning",
  overdue: "destructive",
  cancelled: "muted",
};

export function DuesSummaryCard({ dues, invoiceBasePath }: { dues: DuesSummary; invoiceBasePath: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Outstanding dues</CardTitle>
          <span className="text-lg font-semibold text-foreground">
            {dues.total_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <CardDescription>
          {dues.student_name} ({dues.admission_number})
        </CardDescription>
      </CardHeader>
      <div className="px-4 pb-4">
        {dues.outstanding_invoices.length === 0 ? (
          <EmptyState message="No outstanding dues — all invoices are settled." />
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Invoice</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Due date</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Due amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dues.outstanding_invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2">
                      <Link href={`${invoiceBasePath}/${invoice.id}`} className="font-medium text-primary hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{invoice.due_date}</td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_BADGE_VARIANT[invoice.status] ?? "muted"}>
                        {INVOICE_STATUS_LABELS[invoice.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {invoice.due_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
