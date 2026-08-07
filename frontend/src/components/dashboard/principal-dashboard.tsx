"use client";

import { useState } from "react";
import { Receipt, UserCog, Users, Wallet } from "lucide-react";

import { FinancialNarrativeCard } from "@/components/dashboard/financial-narrative-card";
import { InstitutionOverview } from "@/components/dashboard/institution-overview";
import { StatCard } from "@/components/dashboard/stat-card";
import { TableCard } from "@/components/dashboard/table-card";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { loginErrorMessage } from "@/hooks/use-auth";
import { usePrincipalDashboardQuery } from "@/hooks/use-dashboard";
import { DEFAULT_PERIOD, type DashboardPeriod } from "@/lib/dashboard-period";
import { deltaFrom, formatCurrency, formatNumber } from "@/lib/format";

export function PrincipalDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>(DEFAULT_PERIOD);
  const { data, isLoading, isError, error, refetch } = usePrincipalDashboardQuery(period);

  const comparison = data?.comparison_label ? `vs ${data.comparison_label.toLowerCase()}` : undefined;
  const stats = data?.stats;

  const statCards = isError ? (
    <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />
  ) : isLoading || !stats ? (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-[104px] w-full rounded" />
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total income"
        value={formatCurrency(stats.total_income_month)}
        icon={Wallet}
        accent="success"
        delta={deltaFrom(stats.total_income_change_percent)}
        caption={comparison}
        className="border-l-success/60"
      />
      <StatCard
        label="Total students"
        value={formatNumber(stats.total_students)}
        icon={Users}
        accent="primary"
        delta={deltaFrom(stats.new_admissions_change_percent)}
        caption={`${formatNumber(stats.new_admissions)} new admissions`}
        className="border-l-primary/60"
      />
      <StatCard
        label="Total staff"
        value={formatNumber(stats.total_staff)}
        icon={UserCog}
        accent="info"
        className="border-l-info/60"
      />
      <StatCard
        label="Dues outstanding"
        value={formatCurrency(stats.dues_outstanding)}
        icon={Receipt}
        accent="warning"
        caption="Across all unpaid invoices"
        className="border-l-warning/60"
      />
    </div>
  );

  return (
    <InstitutionOverview
      role="principal"
      title="Principal dashboard"
      subtitle="Institution-wide overview across academics, finance, and staff."
      period={period}
      onPeriodChange={setPeriod}
      statCards={statCards}
    >
      {data && (
        <FinancialNarrativeCard
          narrative={data.financial_narrative}
          narrativeError={data.financial_narrative_error}
        />
      )}
      <TableCard
        title="Recent invoices"
        meta="Latest billing activity across the institution"
        columns={[
          { key: "student", label: "Student" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "status", label: "Status" },
          { key: "due", label: "Due date", align: "right" },
        ]}
        rows={data?.recent_invoices}
        emptyMessage="No invoices yet."
      />
    </InstitutionOverview>
  );
}
