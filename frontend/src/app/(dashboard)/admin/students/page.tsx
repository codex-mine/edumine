"use client";

import { useState } from "react";
import { Plus, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { GuardianLinkManagerDialog } from "@/components/modules/people/guardian-link-manager-dialog";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { StudentDetailDialog } from "@/components/modules/people/student-detail-dialog";
import { StudentFormDialog } from "@/components/modules/people/student-form-dialog";
import { ActiveBadge, StatusBadge } from "@/components/modules/people/status-badge";
import { loginErrorMessage } from "@/hooks/use-auth";
import {
  useHardDeleteStudentMutation,
  useSoftDeleteStudentMutation,
  useStudentsQuery,
} from "@/hooks/use-students";
import { useAuth } from "@/providers/auth-provider";

const LIMIT = 5;

export default function AdminStudentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

  const query = useStudentsQuery({ page, limit: LIMIT, search: search || undefined });
  const softDeleteMutation = useSoftDeleteStudentMutation();
  const hardDeleteMutation = useHardDeleteStudentMutation();

  const rows = (query.data?.items ?? []).map((student) => ({
    name: (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{student.full_name}</span>
        <span className="text-xs text-muted-foreground">{student.phone}</span>
      </div>
    ),
    admission_number: student.admission_number,
    class_section: student.class_name ? (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">
          {student.class_name} - {student.section_name}
        </span>
        <span className="text-xs text-muted-foreground">Roll {student.roll_number}</span>
      </div>
    ) : (
      <span className="text-xs text-muted-foreground">Not enrolled</span>
    ),
    status: <StatusBadge status={student.status} />,
    active: <ActiveBadge isActive={student.is_active} />,
    guardians: (
      <GuardianLinkManagerDialog
        studentId={student.id}
        trigger={
          <Button variant="outline"  >
            <UserCog className="size-6" aria-hidden="true" />
            Guardians
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onEdit={undefined}
        onSoftDelete={() => softDeleteMutation.mutate(student.id)}
        onHardDelete={user?.role === "principal" ? () => hardDeleteMutation.mutate(student.id) : undefined}
        softDeleteDescription="The student's account is deactivated and hidden from active lists. Academic and billing history is preserved."
        hardDeleteDescription="This permanently removes the student's account and profile. Use only for erroneous entries."
        isDeleting={softDeleteMutation.isPending || hardDeleteMutation.isPending}
      />
    ),
    edit: (
      <StudentFormDialog
        student={student}
        trigger={
          <Button variant="secondary" >
            Edit
          </Button>
        }
      />
    ),
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Students</h1>
        <p className="text-sm text-muted-foreground">Manage student admissions and profiles.</p>
      </div>

      <DataTable
        title="All students"
        description="Every admitted student in the institute."
        columns={[
          { key: "name", label: "Student" },
          { key: "admission_number", label: "Admission #" },
          { key: "class_section", label: "Class / Roll" },
          { key: "status", label: "Status" },
          { key: "active", label: "Account" },
          { key: "guardians", label: "Guardians" },
          { key: "edit", label: "Edit" },
          { key: "actions", label: "Actions" },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error ? loginErrorMessage(query.error) : undefined}
        onRetry={() => query.refetch()}
        emptyMessage="No students admitted yet."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by name, email, or admission number"
        page={page}
        limit={LIMIT}
        total={query.data?.meta.total ?? 0}
        onPageChange={setPage}
        onRowClick={(index) => {
          const rowStudent = query.data?.items[index];
          if (rowStudent) setDetailStudentId(rowStudent.id);
        }}
        toolbarActions={
          <StudentFormDialog
            trigger={
              <Button  >
                <Plus className="size-6"  aria-hidden="true" />
                Admit student
              </Button>
            }
          />
        }
      />

      <StudentDetailDialog
        studentId={detailStudentId}
        open={detailStudentId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailStudentId(null);
        }}
      />
    </div>
  );
}
