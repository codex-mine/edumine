"use client";

import { useState } from "react";
import { CalendarCheck, Clock, UserPlus, Wallet } from "lucide-react";

import { AtRiskStudentsWidget } from "@/components/dashboard/at-risk-students-widget";
import { AttendanceInsightWidget } from "@/components/dashboard/attendance-insight-widget";
import { InstitutionOverview } from "@/components/dashboard/institution-overview";
import { PendingActivationsCard } from "@/components/dashboard/pending-activations-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAdminDashboardQuery } from "@/hooks/use-dashboard";
import { DEFAULT_PERIOD, type DashboardPeriod } from "@/lib/dashboard-period";
import { deltaFrom, formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export function AdminDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>(DEFAULT_PERIOD);
  const { data, isLoading, isError, error, refetch } = useAdminDashboardQuery(period);

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
        label="New admissions"
        value={formatNumber(stats.new_admissions)}
        icon={UserPlus}
        accent="primary"
        delta={deltaFrom(stats.new_admissions_change_percent)}
        caption={comparison}
        className="border-l-primary/60"
      />
      <StatCard
        label="Attendance rate"
        value={formatPercent(stats.attendance_percent)}
        icon={CalendarCheck}
        accent="success"
        delta={deltaFrom(stats.attendance_change_percent)}
        caption={stats.attendance_percent === null ? "Nothing marked yet" : comparison}
        className="border-l-success/60"
      />
      <StatCard
        label="Pending approvals"
        value={formatNumber(stats.pending_approvals)}
        icon={Clock}
        accent="warning"
        caption="Activations & expenses"
        className="border-l-warning/60"
      />
      <StatCard
        label="Fees collected"
        value={formatCurrency(stats.collections)}
        icon={Wallet}
        accent="info"
        delta={deltaFrom(stats.collections_change_percent)}
        caption={comparison}
        className="border-l-info/60"
      />
    </div>
  );

  return (
    <InstitutionOverview
      role="admin"
      title="Admin dashboard"
      subtitle="Admissions, attendance, and billing at a glance."
      period={period}
      onPeriodChange={setPeriod}
      statCards={statCards}
    >
      <PendingActivationsCard />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <AttendanceInsightWidget />
        <AtRiskStudentsWidget />
      </div>
    </InstitutionOverview>
  );
}
