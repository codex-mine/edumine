"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { AcademicYearSelect } from "@/components/modules/academic/academic-year-select";
import { SectionDetailDialog } from "@/components/modules/academic/section-detail-dialog";
import { SectionFormDialog } from "@/components/modules/academic/section-form-dialog";
import { ClassSubjectFormDialog } from "@/components/modules/academic/class-subject-form-dialog";
import { formatSectionOccupancy, type ClassSubject, type Section } from "@/lib/api/academic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { loginErrorMessage } from "@/hooks/use-auth";
import {
  useActiveAcademicYearQuery,
  useClassesQuery,
  useClassSubjectsQuery,
  useDeleteClassSubjectMutation,
  useDeleteSectionMutation,
  useSectionsQuery,
} from "@/hooks/use-academic";

const ALL_CLASSES = "__all__";

/** These endpoints return the whole scoped list rather than a page, so search is
 * a filter over what is already in hand — no round trip, no `search` param. */
function matchesSearch(term: string, ...fields: (string | number | null | undefined)[]): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field != null && String(field).toLowerCase().includes(needle));
}

export default function AcademicSectionsPage() {
  const activeYearQuery = useActiveAcademicYearQuery();
  const [selectedYearOverride, setSelectedYearOverride] = useState("");
  const selectedYearId = selectedYearOverride || activeYearQuery.data?.id || "";
  const [classFilter, setClassFilter] = useState(ALL_CLASSES);
  const [sectionSearch, setSectionSearch] = useState("");
  const [classSubjectSearch, setClassSubjectSearch] = useState("");
  const [detailSection, setDetailSection] = useState<Section | null>(null);

  const classesQuery = useClassesQuery();
  const classIdParam = classFilter === ALL_CLASSES ? undefined : classFilter;

  const sectionsQuery = useSectionsQuery({ academic_year_id: selectedYearId || undefined, class_id: classIdParam });
  const classSubjectsQuery = useClassSubjectsQuery({
    academic_year_id: selectedYearId || undefined,
    class_id: classIdParam,
  });

  const deleteSectionMutation = useDeleteSectionMutation();
  const deleteClassSubjectMutation = useDeleteClassSubjectMutation();

  const visibleSections = (sectionsQuery.data ?? []).filter((section: Section) =>
    matchesSearch(sectionSearch, section.name, section.class_name, section.room_name, section.class_teacher_name)
  );
  const visibleClassSubjects = (classSubjectsQuery.data ?? []).filter((row: ClassSubject) =>
    matchesSearch(classSubjectSearch, row.class_name, row.subject_name, row.subject_code, row.teacher_name)
  );

  const sectionRows = visibleSections.map((section) => ({
    class_name: section.class_name,
    name: <span className="font-medium text-foreground">{section.name}</span>,
    room: section.room_name ?? "—",
    capacity: formatSectionOccupancy(section),
    class_teacher: section.class_teacher_name ?? "Unassigned",
    edit: (
      <SectionFormDialog
        academicYearId={selectedYearId}
        section={section}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onView={() => setDetailSection(section)}
        onSoftDelete={() => deleteSectionMutation.mutate(section.id)}
        softDeleteDescription="This section is hidden from active lists. Enrollment and routine history are preserved."
        isDeleting={deleteSectionMutation.isPending}
      />
    ),
  }));

  const classSubjectRows = visibleClassSubjects.map((row) => ({
    class_name: row.class_name,
    subject: `${row.subject_name} (${row.subject_code})`,
    teacher: row.teacher_name ?? "Unassigned",
    full_marks: row.full_marks,
    edit: (
      <ClassSubjectFormDialog
        academicYearId={selectedYearId}
        classSubject={row}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onSoftDelete={() => deleteClassSubjectMutation.mutate(row.id)}
        softDeleteLabel="Remove"
        softDeleteDescription="This removes the subject-teacher assignment from this class for this academic year."
        isDeleting={deleteClassSubjectMutation.isPending}
      />
    ),
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Sections &amp; subject assignment</h1>
        <p className="text-sm text-muted-foreground">
          Manage class sections and class-subject-teacher assignments, scoped per academic year.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>Choose which academic year and class to manage.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end">
          <AcademicYearSelect value={selectedYearId} onChange={setSelectedYearOverride} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="class_filter">Class filter</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger id="class_filter" className="w-full sm:w-[14rem]">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CLASSES}>All classes</SelectItem>
                {(classesQuery.data ?? []).map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
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
            <CardDescription>
              Create and activate an academic year first, then return here to manage sections.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <DataTable
            title="Sections"
            description="Class sections for the selected academic year."
            columns={[
              { key: "class_name", label: "Class" },
              { key: "name", label: "Section" },
              { key: "room", label: "Room" },
              { key: "capacity", label: "Capacity" },
              { key: "class_teacher", label: "Class teacher" },
              { key: "edit", label: "" },
              { key: "actions", label: "" },
            ]}
            rows={sectionRows}
            isLoading={sectionsQuery.isLoading}
            isError={sectionsQuery.isError}
            errorMessage={sectionsQuery.error ? loginErrorMessage(sectionsQuery.error) : undefined}
            onRetry={() => sectionsQuery.refetch()}
            emptyMessage={
              sectionSearch ? "No sections match your search." : "No sections created for this scope yet."
            }
            searchValue={sectionSearch}
            onSearchChange={setSectionSearch}
            searchPlaceholder="Search by section, class, room, or teacher"
            page={1}
            limit={Math.max(sectionRows.length, 1)}
            total={sectionRows.length}
            onPageChange={() => {}}
            onRowClick={(index) => {
              const row = visibleSections[index];
              if (row) setDetailSection(row);
            }}
            toolbarActions={
              <SectionFormDialog
                academicYearId={selectedYearId}
                trigger={
                  <Button  >
                    <Plus className="size-8" aria-hidden="true" />
                    Add section
                  </Button>
                }
              />
            }
          />

          <DataTable
            title="Class-subject-teacher assignments"
            description="Which subjects are taught in which class, and by whom, for the selected academic year."
            columns={[
              { key: "class_name", label: "Class" },
              { key: "subject", label: "Subject" },
              { key: "teacher", label: "Teacher" },
              { key: "full_marks", label: "Full marks" },
              { key: "edit", label: "" },
              { key: "actions", label: "" },
            ]}
            rows={classSubjectRows}
            isLoading={classSubjectsQuery.isLoading}
            isError={classSubjectsQuery.isError}
            errorMessage={classSubjectsQuery.error ? loginErrorMessage(classSubjectsQuery.error) : undefined}
            onRetry={() => classSubjectsQuery.refetch()}
            emptyMessage={
              classSubjectSearch
                ? "No assignments match your search."
                : "No subjects assigned for this scope yet."
            }
            searchValue={classSubjectSearch}
            onSearchChange={setClassSubjectSearch}
            searchPlaceholder="Search by class, subject, code, or teacher"
            page={1}
            limit={Math.max(classSubjectRows.length, 1)}
            total={classSubjectRows.length}
            onPageChange={() => {}}
            toolbarActions={
              <ClassSubjectFormDialog
                academicYearId={selectedYearId}
                defaultClassId={classFilter === ALL_CLASSES ? undefined : classFilter}
                trigger={
                  <Button  >
                    <Plus className="size-8" aria-hidden="true" />
                    Assign subject
                  </Button>
                }
              />
            }
          />
        </>
      )}

      <SectionDetailDialog
        section={detailSection}
        open={detailSection !== null}
        onOpenChange={(open) => {
          if (!open) setDetailSection(null);
        }}
      />
    </div>
  );
}
