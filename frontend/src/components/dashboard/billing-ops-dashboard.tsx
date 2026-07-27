"use client";

import { FileText, Receipt, Wallet } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";

import { ListCard, type ListCardItem } from "@/components/dashboard/list-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { TableCard } from "@/components/dashboard/table-card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import type { BillingOpsDashboard as BillingOpsDashboardData } from "@/lib/api/dashboard";

/** Shared by the Accountant and Receptionist dashboards — both roles see the same
 * front-desk collections/dues overview (requirements.md: Accountant/Receptionist are
 * staff sub-roles with identical billing-operations scope). */
export function BillingOpsDashboard({
  title,
  description,
  query,
}: {
  title: string;
  description: string;
  query: UseQueryResult<BillingOpsDashboardData>;
}) {
  const { data, isLoading, isError, error, refetch } = query;

  if (isLoading) return <LoadingState label="Loading billing overview..." />;
  if (isError) return <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />;
  if (!data) return null;

  const paymentItems: ListCardItem[] = data.recent_payments.map((payment) => ({
    id: payment.id,
    icon: Wallet,
    label: payment.label,
    secondary: payment.secondary,
    trailing: payment.trailing,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Today's collections"
          value={data.stats.todays_collections.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          icon={Wallet}
          accent="success"
        />
        <StatCard
          label="Dues outstanding"
          value={data.stats.dues_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          icon={Receipt}
          accent="warning"
        />
        <StatCard label="Pending invoices" value={data.stats.pending_invoices} icon={FileText} accent="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListCard title="Recent payments" meta="Latest recorded payments" items={paymentItems} emptyMessage="No payments recorded yet." />
        <TableCard
          title="Outstanding dues"
          meta="Students with unpaid balances"
          columns={[
            { key: "student", label: "Student" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "due", label: "Due date", align: "right" },
          ]}
          rows={data.outstanding_dues_rows}
        />
      </div>
    </div>
  );
}
