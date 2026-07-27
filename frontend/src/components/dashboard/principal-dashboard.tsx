"use client";

import { Receipt, UserCog, Users, Wallet } from "lucide-react";

import { ChartCard } from "@/components/dashboard/chart-card";
import { FinancialNarrativeCard } from "@/components/dashboard/financial-narrative-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { TableCard } from "@/components/dashboard/table-card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { usePrincipalDashboardQuery } from "@/hooks/use-dashboard";

export function PrincipalDashboard() {
  const { data, isLoading, isError, error, refetch } = usePrincipalDashboardQuery();

  if (isLoading) return <LoadingState label="Loading institution overview..." />;
  if (isError) return <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Principal dashboard</h1>
        <p className="text-sm text-muted-foreground">Institution-wide overview across academics, finance, and staff.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total income (month)"
          value={data.stats.total_income_month.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          icon={Wallet}
          accent="success"
        />
        <StatCard label="Total students" value={data.stats.total_students} icon={Users} accent="primary" />
        <StatCard label="Total staff" value={data.stats.total_staff} icon={UserCog} accent="info" />
        <StatCard
          label="Dues outstanding"
          value={data.stats.dues_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          icon={Receipt}
          accent="warning"
        />
      </div>

      <FinancialNarrativeCard narrative={data.financial_narrative} narrativeError={data.financial_narrative_error} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Fee collection trend"
          subtitle="Monthly collections, last 6 months"
          type="line"
          data={data.fee_trend}
          xKey="label"
          yKey="collections"
          emptyMessage="No payment history yet."
        />
        <TableCard
          title="Recent invoices"
          meta="Latest billing activity across the institution"
          columns={[
            { key: "student", label: "Student" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "status", label: "Status" },
            { key: "due", label: "Due date", align: "right" },
          ]}
          rows={data.recent_invoices}
          emptyMessage="No invoices yet."
        />
      </div>
    </div>
  );
}
