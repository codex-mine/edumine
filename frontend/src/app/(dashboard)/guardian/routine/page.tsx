"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { RoutineGrid } from "@/components/modules/routine/routine-grid";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyGuardianRoutineQuery } from "@/hooks/use-routine";

export default function GuardianRoutinePage() {
  const routineQuery = useMyGuardianRoutineQuery();
  const children = routineQuery.data?.children ?? [];

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Children&apos;s routines</h1>
        <p className="text-sm text-muted-foreground">Weekly class schedule for each of your linked children.</p>
      </div>

      {routineQuery.isLoading ? (
        <LoadingState label="Loading routines..." />
      ) : routineQuery.isError ? (
        <ErrorState message={loginErrorMessage(routineQuery.error)} onRetry={() => routineQuery.refetch()} />
      ) : children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No linked children found</CardTitle>
            <CardDescription>Once a child is enrolled for the active academic year, their routine appears here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        children.map((child) => (
          <Card key={child.student_id}>
            <CardHeader>
              <CardTitle>
                {child.student_name} &middot; {child.section.class_name} - {child.section.section_name}
              </CardTitle>
              <CardDescription>Subject, teacher, and room for each period.</CardDescription>
            </CardHeader>
            <div className="px-4 pb-4">
              {child.section.slots.length === 0 ? (
                <EmptyState message="This section's routine hasn't been scheduled yet." />
              ) : (
                <RoutineGrid slots={child.section.slots} />
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
