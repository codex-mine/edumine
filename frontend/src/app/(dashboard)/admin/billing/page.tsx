"use client";

import { BillingWorkspace } from "@/components/modules/billing/billing-workspace";

export default function AdminBillingPage() {
  return <BillingWorkspace invoiceListPath="/admin/billing/invoices" />;
}
