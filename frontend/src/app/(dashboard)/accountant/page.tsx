"use client";

import { BillingOpsDashboard } from "@/components/dashboard/billing-ops-dashboard";
import { useAccountantDashboardQuery } from "@/hooks/use-dashboard";

export default function AccountantDashboardPage() {
  const query = useAccountantDashboardQuery();
  return <BillingOpsDashboard title="Accountant dashboard" description="Collections, dues, and payments overview." query={query} />;
}
