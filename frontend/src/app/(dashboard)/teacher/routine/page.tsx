"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { RoutineGrid } from "@/components/modules/routine/routine-grid";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyTeacherRoutineQuery } from "@/hooks/use-routine";

export default function TeacherRoutinePage() {
  const routineQuery = useMyTeacherRoutineQuery();
  const slots = routineQuery.data ?? [];

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My schedule</h1>
        <p className="text-sm text-muted-foreground">Your weekly teaching schedule across all assigned sections.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly routine</CardTitle>
          <CardDescription>Each cell shows the class and section you teach at that period.</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          {routineQuery.isLoading ? (
            <LoadingState label="Loading your schedule..." />
          ) : routineQuery.isError ? (
            <ErrorState message={loginErrorMessage(routineQuery.error)} onRetry={() => routineQuery.refetch()} />
          ) : slots.length === 0 ? (
            <EmptyState message="You have no scheduled periods yet." />
          ) : (
            <RoutineGrid slots={slots} showSection />
          )}
        </div>
      </Card>
    </div>
  );
}
