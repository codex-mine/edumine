"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/modules/people/status-badge";
import { AcademicYearSelect } from "@/components/modules/academic/academic-year-select";
import { EnrollStudentDialog } from "@/components/modules/academic/enroll-student-dialog";
import { PromoteStudentsPanel } from "@/components/modules/academic/promote-students-panel";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useActiveAcademicYearQuery, useEnrollmentsQuery } from "@/hooks/use-academic";

export default function AcademicEnrollmentPage() {
  const activeYearQuery = useActiveAcademicYearQuery();
  const [selectedYearOverride, setSelectedYearOverride] = useState("");
  const selectedYearId = selectedYearOverride || activeYearQuery.data?.id || "";

  const enrollmentsQuery = useEnrollmentsQuery({ academic_year_id: selectedYearId || undefined });

  const rows = (enrollmentsQuery.data ?? []).map((enrollment) => ({
    roll_number: enrollment.roll_number,
    student: (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{enrollment.student_name}</span>
        <span className="text-xs text-muted-foreground">{enrollment.admission_number}</span>
      </div>
    ),
    class_section: `${enrollment.class_name} - ${enrollment.section_name}`,
    status: <StatusBadge status={enrollment.status} />,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Enrollment &amp; promotion</h1>
        <p className="text-sm text-muted-foreground">
          Enroll students into a class/section for the active year, or promote existing students into a new year.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>Choose which academic year&apos;s enrollments to view.</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          <AcademicYearSelect value={selectedYearId} onChange={setSelectedYearOverride} />
        </div>
      </Card>

      {selectedYearId && (
        <DataTable
          title="Enrollments"
          description="Students enrolled for the selected academic year."
          columns={[
            { key: "roll_number", label: "Roll #" },
            { key: "student", label: "Student" },
            { key: "class_section", label: "Class - Section" },
            { key: "status", label: "Status" },
          ]}
          rows={rows}
          isLoading={enrollmentsQuery.isLoading}
          isError={enrollmentsQuery.isError}
          errorMessage={enrollmentsQuery.error ? loginErrorMessage(enrollmentsQuery.error) : undefined}
          onRetry={() => enrollmentsQuery.refetch()}
          emptyMessage="No students enrolled for this academic year yet."
          searchValue=""
          onSearchChange={() => {}}
          searchPlaceholder="Search"
          page={1}
          limit={Math.max(rows.length, 1)}
          total={rows.length}
          onPageChange={() => {}}
          toolbarActions={
            <EnrollStudentDialog
              academicYearId={selectedYearId}
              trigger={
                <Button  >
                  <Plus className="size-8" aria-hidden="true" />
                  Enroll student
                </Button>
              }
            />
          }
        />
      )}

      <PromoteStudentsPanel />
    </div>
  );
}
