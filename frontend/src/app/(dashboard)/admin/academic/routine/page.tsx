"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AcademicYearSelect } from "@/components/modules/academic/academic-year-select";
import { RoutineGrid, RoutineSlotCard } from "@/components/modules/routine/routine-grid";
import { RoutineSlotFormDialog } from "@/components/modules/routine/routine-slot-form-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useActiveAcademicYearQuery, useClassesQuery, useSectionsQuery } from "@/hooks/use-academic";
import { useDeleteRoutineSlotMutation, useSectionRoutineQuery } from "@/hooks/use-routine";

export default function AdminRoutinePage() {
  const activeYearQuery = useActiveAcademicYearQuery();
  const [selectedYearOverride, setSelectedYearOverride] = useState("");
  const selectedYearId = selectedYearOverride || activeYearQuery.data?.id || "";

  const classesQuery = useClassesQuery();
  const [classId, setClassId] = useState("");

  const sectionsQuery = useSectionsQuery({ academic_year_id: selectedYearId || undefined, class_id: classId || undefined });
  const [sectionId, setSectionId] = useState("");
  const section = (sectionsQuery.data ?? []).find((s) => s.id === sectionId);

  const routineQuery = useSectionRoutineQuery(sectionId);
  const deleteMutation = useDeleteRoutineSlotMutation();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Routine builder</h1>
        <p className="text-sm text-muted-foreground">
          Build each section&apos;s weekly timetable. A teacher already booked for another section at the same day
          and period is rejected automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>Choose the academic year, class, and section to schedule.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end">
          <AcademicYearSelect
            value={selectedYearId}
            onChange={(value) => {
              setSelectedYearOverride(value);
              setClassId("");
              setSectionId("");
            }}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="routine_class">Class</Label>
            <Select
              value={classId || undefined}
              onValueChange={(value) => {
                setClassId(value);
                setSectionId("");
              }}
              disabled={!selectedYearId}
            >
              <SelectTrigger id="routine_class" className="w-full sm:w-[14rem]">
                <SelectValue placeholder={selectedYearId ? "Select a class" : "Select a year first"} />
              </SelectTrigger>
              <SelectContent>
                {(classesQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="routine_section">Section</Label>
            <Select value={sectionId || undefined} onValueChange={setSectionId} disabled={!classId}>
              <SelectTrigger id="routine_section" className="w-full sm:w-[16rem]">
                <SelectValue placeholder={classId ? "Select a section" : "Select a class first"} />
              </SelectTrigger>
              <SelectContent>
                {(sectionsQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {!selectedYearId ? (
        <Card>
          <CardHeader>
            <CardTitle>No academic year selected</CardTitle>
            <CardDescription>Create and activate an academic year first, then return here.</CardDescription>
          </CardHeader>
        </Card>
      ) : !classId ? (
        <Card>
          <CardHeader>
            <CardTitle>No class selected</CardTitle>
            <CardDescription>Choose a class above to pick a section and build its weekly routine.</CardDescription>
          </CardHeader>
        </Card>
      ) : !sectionId || !section ? (
        <Card>
          <CardHeader>
            <CardTitle>No section selected</CardTitle>
            <CardDescription>Choose a section above to view and build its weekly routine.</CardDescription>
          </CardHeader>
        </Card>
      ) : routineQuery.isLoading ? (
        <LoadingState label="Loading routine..." />
      ) : routineQuery.isError ? (
        <ErrorState message={loginErrorMessage(routineQuery.error)} onRetry={() => routineQuery.refetch()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {section.class_name} - {section.name}
            </CardTitle>
            <CardDescription>Click an empty period to add a class; existing slots can be edited or removed.</CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <RoutineGrid
              slots={routineQuery.data?.slots ?? []}
              renderCell={({ day, period, slot }) =>
                slot ? (
                  <div className="flex flex-col gap-1.5">
                    <RoutineSlotCard slot={slot} />
                    <div className="flex gap-1">
                      <RoutineSlotFormDialog
                        academicYearId={selectedYearId}
                        sectionId={section.id}
                        classId={section.class_id}
                        slot={slot}
                        trigger={
                          <Button variant="ghost" size="sm" className="h-7 flex-1 px-2 text-xs">
                            Edit
                          </Button>
                        }
                      />
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive">
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        }
                        title="Remove this routine slot?"
                        description={`This clears ${slot.subject_name} on ${day}, period ${period}.`}
                        confirmLabel="Remove"
                        onConfirm={() => deleteMutation.mutate(slot.id)}
                        isPending={deleteMutation.isPending}
                      />
                    </div>
                  </div>
                ) : (
                  <RoutineSlotFormDialog
                    academicYearId={selectedYearId}
                    sectionId={section.id}
                    classId={section.class_id}
                    defaultDay={day}
                    defaultPeriod={period}
                    trigger={
                      <button
                        type="button"
                        className="flex h-16 w-full items-center justify-center rounded border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                        aria-label={`Add class on ${day}, period ${period}`}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    }
                  />
                )
              }
            />
          </div>
        </Card>
      )}
    </div>
  );
}
