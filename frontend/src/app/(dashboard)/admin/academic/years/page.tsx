"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ActiveBadge } from "@/components/modules/people/status-badge";
import { AcademicYearFormDialog } from "@/components/modules/academic/academic-year-form-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAcademicYearsQuery, useActivateAcademicYearMutation } from "@/hooks/use-academic";

export default function AcademicYearsPage() {
  const yearsQuery = useAcademicYearsQuery();
  const activateMutation = useActivateAcademicYearMutation();

  const years = yearsQuery.data ?? [];

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Academic years</h1>
        <p className="text-sm text-muted-foreground">
          Only one academic year is active at a time. All academic, billing, and exam data scope to the active year.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All academic years</CardTitle>
          <CardDescription>Create a new year fresh, or carry forward structure from a prior year.</CardDescription>
        </CardHeader>

        <div className="flex justify-end px-4">
          <AcademicYearFormDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4" aria-hidden="true" />
                Create academic year
              </Button>
            }
          />
        </div>

        {yearsQuery.isLoading ? (
          <LoadingState label="Loading academic years..." />
        ) : yearsQuery.isError ? (
          <div className="px-4 pb-1">
            <ErrorState message={loginErrorMessage(yearsQuery.error)} onRetry={() => yearsQuery.refetch()} />
          </div>
        ) : years.length === 0 ? (
          <div className="px-4 pb-1">
            <EmptyState message="No academic years created yet." />
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-4 pb-2">
            {years.map((year) => (
              <div
                key={year.id}
                className="flex flex-col gap-2 rounded border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{year.name}</span>
                    <ActiveBadge isActive={year.is_active} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {year.start_date} &rarr; {year.end_date}
                    {year.cloned_from_year_id && " · carried forward from a prior year"}
                  </span>
                </div>
                {!year.is_active && (
                  <ConfirmDialog
                    trigger={<Button size="sm" variant="outline">Activate</Button>}
                    title={`Activate ${year.name}?`}
                    description="This deactivates the currently active academic year. All modules will begin scoping to this year by default."
                    confirmLabel="Activate"
                    destructive={false}
                    isPending={activateMutation.isPending}
                    onConfirm={() => activateMutation.mutate(year.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
