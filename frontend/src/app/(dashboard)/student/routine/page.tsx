"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { RoutineGrid } from "@/components/modules/routine/routine-grid";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyStudentRoutineQuery } from "@/hooks/use-routine";

export default function StudentRoutinePage() {
  const routineQuery = useMyStudentRoutineQuery();
  const section = routineQuery.data?.section;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My class routine</h1>
        <p className="text-sm text-muted-foreground">Your section&apos;s weekly class schedule.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{section ? `${section.class_name} - ${section.section_name}` : "Weekly routine"}</CardTitle>
          <CardDescription>Subject, teacher, and room for each period.</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          {routineQuery.isLoading ? (
            <LoadingState label="Loading your routine..." />
          ) : routineQuery.isError ? (
            <ErrorState message={loginErrorMessage(routineQuery.error)} onRetry={() => routineQuery.refetch()} />
          ) : !section || section.slots.length === 0 ? (
            <EmptyState message="Your section's routine hasn't been scheduled yet." />
          ) : (
            <RoutineGrid slots={section.slots} />
          )}
        </div>
      </Card>
    </div>
  );
}
