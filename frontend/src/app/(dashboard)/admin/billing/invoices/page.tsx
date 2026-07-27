"use client";

import { InvoiceListTable } from "@/components/modules/billing/invoice-list-table";

export default function AdminInvoicesPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground">Search and manage student invoices.</p>
      </div>
      <InvoiceListTable invoiceBasePath="/admin/billing/invoices" />
    </div>
  );
}
