"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { AcademicYearSelect } from "@/components/modules/academic/academic-year-select";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useEnrollmentsQuery, useSectionsQuery, usePromoteStudentsMutation } from "@/hooks/use-academic";
import type { EnrollmentStatus } from "@/lib/api/academic";

const OUTCOMES: { value: EnrollmentStatus; label: string }[] = [
  { value: "promoted", label: "Promote to target section" },
  { value: "graduated", label: "Graduated (leaving)" },
  { value: "transferred", label: "Transferred out" },
  { value: "dropped", label: "Dropped" },
];

interface RowState {
  outcome: EnrollmentStatus;
  rollNumber: string;
}

export function PromoteStudentsPanel() {
  const [sourceYearId, setSourceYearId] = useState("");
  const [sourceSectionId, setSourceSectionId] = useState("");
  const [targetYearId, setTargetYearId] = useState("");
  const [targetSectionId, setTargetSectionId] = useState("");
  const [overrides, setOverrides] = useState<Record<string, Partial<RowState>>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sourceSectionsQuery = useSectionsQuery({ academic_year_id: sourceYearId || undefined });
  const targetSectionsQuery = useSectionsQuery({ academic_year_id: targetYearId || undefined });
  const enrollmentsQuery = useEnrollmentsQuery({
    academic_year_id: sourceYearId || undefined,
    section_id: sourceSectionId || undefined,
  });
  const promoteMutation = usePromoteStudentsMutation();

  const students = useMemo(
    () => (enrollmentsQuery.data ?? []).filter((e) => e.status === "active"),
    [enrollmentsQuery.data]
  );

  function rowStateFor(studentId: string, defaultRollNumber: string): RowState {
    return {
      outcome: overrides[studentId]?.outcome ?? "promoted",
      rollNumber: overrides[studentId]?.rollNumber ?? defaultRollNumber,
    };
  }

  function updateRow(studentId: string, patch: Partial<RowState>) {
    setOverrides((previous) => ({ ...previous, [studentId]: { ...previous[studentId], ...patch } }));
  }

  function handleSourceSectionChange(value: string) {
    setSourceSectionId(value);
    setOverrides({});
    setSuccessMessage(null);
  }

  async function handleSubmit() {
    setError(null);
    setSuccessMessage(null);
    if (!targetYearId) {
      setError("Select a target academic year");
      return;
    }
    const items = students.map((enrollment) => {
      const rowState = rowStateFor(enrollment.student_id, enrollment.roll_number);
      const promoted = rowState.outcome === "promoted";
      return {
        student_id: enrollment.student_id,
        outcome: rowState.outcome,
        target_section_id: promoted ? targetSectionId : undefined,
        roll_number: promoted ? rowState.rollNumber : undefined,
      };
    });

    if (items.some((item) => item.outcome === "promoted") && !targetSectionId) {
      setError("Select a target section for promoted students");
      return;
    }

    try {
      const results = await promoteMutation.mutateAsync({
        target_academic_year_id: targetYearId,
        source_academic_year_id: sourceYearId || undefined,
        items,
      });
      setSuccessMessage(`Processed ${results.length} student(s).`);
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promote students</CardTitle>
        <CardDescription>
          Move all currently enrolled students from a source section into a target section in a new academic year —
          or mark them graduated, transferred, or dropped instead.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-3 rounded border border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <AcademicYearSelect value={sourceYearId} onChange={(value) => { setSourceYearId(value); setSourceSectionId(""); }} label="Source year" id="promo_source_year" />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo_source_section">Source section</Label>
              <Select value={sourceSectionId || undefined} onValueChange={handleSourceSectionChange}>
                <SelectTrigger id="promo_source_section">
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {(sourceSectionsQuery.data ?? []).map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.class_name} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />

          <div className="flex flex-1 flex-col gap-3 rounded border border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <AcademicYearSelect value={targetYearId} onChange={(value) => { setTargetYearId(value); setTargetSectionId(""); }} label="Target year" id="promo_target_year" />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo_target_section">Target section</Label>
              <Select value={targetSectionId || undefined} onValueChange={setTargetSectionId}>
                <SelectTrigger id="promo_target_section">
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {(targetSectionsQuery.data ?? []).map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.class_name} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {sourceSectionId && (
          <div className="flex flex-col gap-2">
            {enrollmentsQuery.isLoading ? (
              <LoadingState label="Loading enrolled students..." />
            ) : students.length === 0 ? (
              <EmptyState message="No actively enrolled students in this source section." />
            ) : (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Roll #</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Student</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Outcome</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground">New roll #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map((enrollment) => {
                      const rowState = rowStateFor(enrollment.student_id, enrollment.roll_number);
                      return (
                        <tr key={enrollment.id}>
                          <td className="px-3 py-2 text-muted-foreground">{enrollment.roll_number}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{enrollment.student_name}</td>
                          <td className="px-3 py-2">
                            <Select
                              value={rowState.outcome}
                              onValueChange={(value) =>
                                updateRow(enrollment.student_id, { outcome: value as EnrollmentStatus })
                              }
                            >
                              <SelectTrigger className="h-[2rem] w-[14rem] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OUTCOMES.map((outcome) => (
                                  <SelectItem key={outcome.value} value={outcome.value}>
                                    {outcome.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-[2rem] w-[6rem] text-xs"
                              value={rowState.rollNumber}
                              disabled={rowState.outcome !== "promoted"}
                              onChange={(e) => updateRow(enrollment.student_id, { rollNumber: e.target.value })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {successMessage && <p className="text-sm text-success">{successMessage}</p>}

        <div>
          <Button
            onClick={handleSubmit}
            disabled={!sourceSectionId || !targetYearId || students.length === 0 || promoteMutation.isPending}
          >
            Process promotion
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
