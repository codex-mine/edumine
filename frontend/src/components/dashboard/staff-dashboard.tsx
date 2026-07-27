"use client";

import { Bell, CalendarCheck, CalendarDays } from "lucide-react";

import { ListCard, type ListCardItem } from "@/components/dashboard/list-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useStaffDashboardQuery } from "@/hooks/use-dashboard";

export function StaffDashboard() {
  const { data, isLoading, isError, error, refetch } = useStaffDashboardQuery();

  if (isLoading) return <LoadingState label="Loading your dashboard..." />;
  if (isError) return <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />;
  if (!data) return null;

  const activityItems: ListCardItem[] = data.recent_activity.map((item) => ({
    id: item.id,
    icon: Bell,
    label: item.label,
    secondary: item.secondary,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Staff dashboard</h1>
        <p className="text-sm text-muted-foreground">Your attendance and recent activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Today's status" value={data.stats.today_status} icon={CalendarCheck} accent="success" />
        <StatCard
          label="This month's attendance"
          value={data.stats.monthly_attendance_percent !== null ? `${data.stats.monthly_attendance_percent}%` : "—"}
          icon={CalendarDays}
          accent="info"
        />
        <StatCard label="Unread announcements" value={data.stats.unread_announcements} icon={Bell} accent="warning" />
      </div>

      <ListCard title="Recent activity" meta="Your latest announcements" items={activityItems} emptyMessage="Nothing new right now." />
    </div>
  );
}
