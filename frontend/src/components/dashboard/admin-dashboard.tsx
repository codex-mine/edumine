"use client";

import { CalendarCheck, Clock, UserPlus, Wallet } from "lucide-react";

import { AtRiskStudentsWidget } from "@/components/dashboard/at-risk-students-widget";
import { AttendanceInsightWidget } from "@/components/dashboard/attendance-insight-widget";
import { ChartCard } from "@/components/dashboard/chart-card";
import { PendingActivationsCard } from "@/components/dashboard/pending-activations-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { TableCard } from "@/components/dashboard/table-card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAdminDashboardQuery } from "@/hooks/use-dashboard";

export function AdminDashboard() {
  const { data, isLoading, isError, error, refetch } = useAdminDashboardQuery();

  if (isLoading) return <LoadingState label="Loading admin overview..." />;
  if (isError) return <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">Admissions, attendance, and billing at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New admissions (month)" value={data.stats.new_admissions_month} icon={UserPlus} accent="primary" />
        <StatCard
          label="Today's attendance"
          value={data.stats.todays_attendance_percent !== null ? `${data.stats.todays_attendance_percent}%` : "—"}
          icon={CalendarCheck}
          accent="success"
          caption={data.stats.todays_attendance_percent === null ? "No records yet today" : undefined}
        />
        <StatCard label="Pending approvals" value={data.stats.pending_approvals} icon={Clock} accent="warning" />
        <StatCard
          label="Today's collections"
          value={data.stats.todays_collections.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          icon={Wallet}
          accent="info"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Attendance this week"
          subtitle="Institution-wide attendance rate"
          type="bar"
          data={data.attendance_week}
          xKey="label"
          yKey="value"
        />
        <TableCard
          title="Today's attendance"
          meta="Live roll call across the institution"
          columns={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "status", label: "Status" },
          ]}
          rows={data.todays_attendance_rows}
        />
      </div>

      <PendingActivationsCard />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttendanceInsightWidget />
        <AtRiskStudentsWidget />
      </div>
    </div>
  );
}
