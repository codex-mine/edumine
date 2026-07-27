"use client";

import { StudentStatsPanel } from "@/components/dashboard/student-stats-panel";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useStudentDashboardQuery } from "@/hooks/use-dashboard";

export function StudentDashboard() {
  const { data, isLoading, isError, error, refetch } = useStudentDashboardQuery();

  if (isLoading) return <LoadingState label="Loading your dashboard..." />;
  if (isError) return <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Student dashboard</h1>
        <p className="text-sm text-muted-foreground">Your attendance, results, and upcoming exams.</p>
      </div>

      <StudentStatsPanel data={data} />
    </div>
  );
}
