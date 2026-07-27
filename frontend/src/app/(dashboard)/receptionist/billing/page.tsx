"use client";

import { InvoiceListTable } from "@/components/modules/billing/invoice-list-table";

export default function ReceptionistBillingPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Billing &amp; fees</h1>
        <p className="text-sm text-muted-foreground">
          Search student invoices and collect fee payments. Fee structure changes are managed by Accountant/Admin.
        </p>
      </div>
      <InvoiceListTable invoiceBasePath="/receptionist/billing" />
    </div>
  );
}
