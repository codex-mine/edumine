"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { DuesSummaryCard } from "@/components/modules/billing/dues-summary-card";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useOwnGuardianProfileQuery } from "@/hooks/use-guardians";
import { useStudentDuesQuery, useStudentInvoicesQuery } from "@/hooks/use-billing";
import { INVOICE_STATUS_LABELS } from "@/lib/api/billing";

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  paid: "success",
  partially_paid: "info",
  unpaid: "warning",
  overdue: "destructive",
  cancelled: "muted",
};

export default function GuardianBillingPage() {
  const profileQuery = useOwnGuardianProfileQuery();
  const [studentId, setStudentId] = useState("");

  const children = profileQuery.data?.students ?? [];
  const resolvedStudentId = studentId || children[0]?.student_id || "";

  const duesQuery = useStudentDuesQuery(resolvedStudentId || null);
  const invoicesQuery = useStudentInvoicesQuery(resolvedStudentId || null);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Children&apos;s billing</h1>
        <p className="text-sm text-muted-foreground">Invoices and outstanding dues for your linked children.</p>
      </div>

      {profileQuery.isLoading ? (
        <LoadingState label="Loading your profile..." />
      ) : children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No linked children found</CardTitle>
            <CardDescription>Once a child is linked to your account, their billing appears here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
              <CardDescription>Choose a child.</CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-1.5 px-4 pb-4 sm:w-[20rem]">
              <Label htmlFor="gb_child">Child</Label>
              <Select value={resolvedStudentId || undefined} onValueChange={setStudentId}>
                <SelectTrigger id="gb_child" className="w-full">
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.student_id} value={child.student_id}>
                      {child.full_name} ({child.admission_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {duesQuery.isLoading ? (
            <LoadingState label="Loading dues..." />
          ) : duesQuery.isError ? (
            <ErrorState message={loginErrorMessage(duesQuery.error)} onRetry={() => duesQuery.refetch()} />
          ) : duesQuery.data ? (
            <DuesSummaryCard dues={duesQuery.data} invoiceBasePath="/guardian/billing" />
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
                            <Link href={`/guardian/billing/${invoice.id}`} className="font-medium text-primary hover:underline">
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
        </>
      )}
    </div>
  );
}
