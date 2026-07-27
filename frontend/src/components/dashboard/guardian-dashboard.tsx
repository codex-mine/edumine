"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { GuardianAssistantCard } from "@/components/dashboard/guardian-assistant-card";
import { StudentStatsPanel } from "@/components/dashboard/student-stats-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useGuardianDashboardQuery } from "@/hooks/use-dashboard";

export function GuardianDashboard() {
  const { data, isLoading, isError, error, refetch } = useGuardianDashboardQuery();

  if (isLoading) return <LoadingState label="Loading your dashboard..." />;
  if (isError) return <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Guardian dashboard</h1>
        <p className="text-sm text-muted-foreground">Your linked child&apos;s attendance, results, and billing.</p>
      </div>

      {data.children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No linked children</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6">
            <EmptyState message="No students are currently linked to your account. Contact the school office." />
          </div>
        </Card>
      ) : (
        data.children.map((child) => (
          <div key={child.student_id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">{child.full_name}</h2>
            <StudentStatsPanel data={child} />
          </div>
        ))
      )}

      <GuardianAssistantCard children={data.children.map((c) => ({ student_id: c.student_id, full_name: c.full_name }))} />
    </div>
  );
}
