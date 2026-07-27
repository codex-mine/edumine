"use client";

import { BillingWorkspace } from "@/components/modules/billing/billing-workspace";

export default function AccountantBillingPage() {
  return <BillingWorkspace invoiceListPath="/accountant/billing/invoices" />;
}
