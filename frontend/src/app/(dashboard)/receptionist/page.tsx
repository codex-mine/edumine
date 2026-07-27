"use client";

import { BillingOpsDashboard } from "@/components/dashboard/billing-ops-dashboard";
import { useReceptionistDashboardQuery } from "@/hooks/use-dashboard";

export default function ReceptionistDashboardPage() {
  const query = useReceptionistDashboardQuery();
  return <BillingOpsDashboard title="Receptionist dashboard" description="Front-desk collections and dues overview." query={query} />;
}
