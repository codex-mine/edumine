"use client";

import { BookOpen, CalendarDays, Clock, PenSquare } from "lucide-react";

import { AtRiskStudentsWidget } from "@/components/dashboard/at-risk-students-widget";
import { AttendanceInsightWidget } from "@/components/dashboard/attendance-insight-widget";
import { ListCard, type ListCardItem } from "@/components/dashboard/list-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { TableCard } from "@/components/dashboard/table-card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useTeacherDashboardQuery } from "@/hooks/use-dashboard";

export function TeacherDashboard() {
  const { data, isLoading, isError, error, refetch } = useTeacherDashboardQuery();

  if (isLoading) return <LoadingState label="Loading your dashboard..." />;
  if (isError) return <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />;
  if (!data) return null;

  const scheduleItems: ListCardItem[] = data.todays_schedule.map((slot) => ({
    id: slot.id,
    icon: Clock,
    label: slot.label,
    secondary: slot.secondary,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Teacher dashboard</h1>
        <p className="text-sm text-muted-foreground">Your classes, attendance, and marks entry for today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's classes" value={data.stats.todays_classes} icon={BookOpen} accent="primary" />
        <StatCard
          label="Attendance marked"
          value={`${data.stats.attendance_marked}/${data.stats.todays_classes}`}
          icon={CalendarDays}
          accent="success"
        />
        <StatCard label="Pending marks entry" value={data.stats.pending_marks_entry} icon={PenSquare} accent="warning" />
        <StatCard
          label="This month's attendance"
          value={data.stats.monthly_attendance_percent !== null ? `${data.stats.monthly_attendance_percent}%` : "—"}
          icon={CalendarDays}
          accent="info"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListCard title="Today's schedule" meta="Your classes for today" items={scheduleItems} emptyMessage="No classes scheduled today." />
        <TableCard
          title="Exam / marks status"
          meta="Entry progress for your assigned exam subjects"
          columns={[
            { key: "exam", label: "Exam" },
            { key: "class", label: "Class" },
            { key: "status", label: "Status" },
          ]}
          rows={data.exam_status_rows}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttendanceInsightWidget />
        <AtRiskStudentsWidget />
      </div>
    </div>
  );
}
