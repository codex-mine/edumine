"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useInvoicesQuery } from "@/hooks/use-billing";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/api/billing";

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  paid: "success",
  partially_paid: "info",
  unpaid: "warning",
  overdue: "destructive",
  cancelled: "muted",
};

const STATUS_OPTIONS: InvoiceStatus[] = ["unpaid", "partially_paid", "paid", "overdue", "cancelled"];

export function InvoiceListTable({ invoiceBasePath, toolbarActions }: { invoiceBasePath: string; toolbarActions?: React.ReactNode }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const invoicesQuery = useInvoicesQuery({
    status: status === "all" ? undefined : status,
    page,
    limit,
  });

  const allItems = invoicesQuery.data?.items ?? [];
  const filtered = search
    ? allItems.filter(
        (invoice) =>
          invoice.student_name.toLowerCase().includes(search.toLowerCase()) ||
          invoice.admission_number.toLowerCase().includes(search.toLowerCase()) ||
          invoice.invoice_number.toLowerCase().includes(search.toLowerCase())
      )
    : allItems;

  const rows = filtered.map((invoice) => ({
    invoice_number: <span className="font-medium text-foreground">{invoice.invoice_number}</span>,
    student: (
      <span>
        {invoice.student_name} <span className="text-xs text-muted-foreground">({invoice.admission_number})</span>
      </span>
    ),
    due_date: invoice.due_date,
    total: invoice.total_amount.toFixed(2),
    due: invoice.due_amount.toFixed(2),
    status: <Badge variant={STATUS_BADGE_VARIANT[invoice.status] ?? "muted"}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>,
  }));

  return (
    <DataTable
      title="Invoices"
      description="All generated invoices, searchable by student or invoice number."
      columns={[
        { key: "invoice_number", label: "Invoice #" },
        { key: "student", label: "Student" },
        { key: "due_date", label: "Due date" },
        { key: "total", label: "Total", align: "right" },
        { key: "due", label: "Due", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
      isLoading={invoicesQuery.isLoading}
      isError={invoicesQuery.isError}
      errorMessage={invoicesQuery.error ? loginErrorMessage(invoicesQuery.error) : undefined}
      onRetry={() => invoicesQuery.refetch()}
      emptyMessage="No invoices found."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by student or invoice #"
      page={page}
      limit={limit}
      total={invoicesQuery.data?.meta.total ?? 0}
      onPageChange={setPage}
      onRowClick={(index) => router.push(`${invoiceBasePath}/${filtered[index].id}`)}
      toolbarActions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as InvoiceStatus | "all")}>
            <SelectTrigger className="w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {INVOICE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {toolbarActions}
        </div>
      }
    />
  );
}
