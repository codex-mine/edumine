import { Award, CalendarClock, CalendarCheck, Receipt } from "lucide-react";

import { ChartCard } from "@/components/dashboard/chart-card";
import { StatCard } from "@/components/dashboard/stat-card";
import type { StudentDashboard } from "@/lib/api/dashboard";

/** Shared attendance/results/dues panel for the Student dashboard and each of a
 * Guardian's linked children — same shape, so the two dashboards render identically. */
export function StudentStatsPanel({ data }: { data: StudentDashboard }) {
  const { stats, attendance_trend } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance (month)"
          value={stats.attendance_percent_month !== null ? `${stats.attendance_percent_month}%` : "—"}
          icon={CalendarCheck}
          accent="success"
        />
        <StatCard
          label="Current due"
          value={stats.current_due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          icon={Receipt}
          accent="warning"
        />
        <StatCard
          label="Latest result"
          value={stats.latest_result ? `${stats.latest_result.percentage}%` : "—"}
          icon={Award}
          accent="primary"
          caption={stats.latest_result?.exam_name}
        />
        <StatCard
          label="Upcoming exam"
          value={stats.upcoming_exam?.name ?? "—"}
          icon={CalendarClock}
          accent="info"
          caption={stats.upcoming_exam?.start_date}
        />
      </div>

      <ChartCard
        title="Attendance trend"
        subtitle="Weekly attendance rate"
        type="line"
        data={attendance_trend}
        xKey="label"
        yKey="value"
        emptyMessage="No attendance history yet."
      />
    </div>
  );
}
