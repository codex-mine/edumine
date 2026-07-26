"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { TeacherDetailDialog } from "@/components/modules/people/teacher-detail-dialog";
import { TeacherFormDialog } from "@/components/modules/people/teacher-form-dialog";
import { ActiveBadge, StatusBadge } from "@/components/modules/people/status-badge";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useHardDeleteTeacherMutation, useSoftDeleteTeacherMutation, useTeachersQuery } from "@/hooks/use-teachers";
import { useAuth } from "@/providers/auth-provider";

const LIMIT = 20;

export default function AdminTeachersPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detailTeacherId, setDetailTeacherId] = useState<string | null>(null);

  const query = useTeachersQuery({ page, limit: LIMIT, search: search || undefined });
  const softDeleteMutation = useSoftDeleteTeacherMutation();
  const hardDeleteMutation = useHardDeleteTeacherMutation();

  const rows = (query.data?.items ?? []).map((teacher) => ({
    name: (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{teacher.full_name}</span>
        <span className="text-xs text-muted-foreground">{teacher.email ?? teacher.phone}</span>
      </div>
    ),
    employee_code: teacher.employee_code,
    designation: teacher.designation ?? "—",
    status: <StatusBadge status={teacher.status} />,
    active: <ActiveBadge isActive={teacher.is_active} />,
    edit: (
      <TeacherFormDialog
        teacher={teacher}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onSoftDelete={() => softDeleteMutation.mutate(teacher.id)}
        onHardDelete={user?.role === "principal" ? () => hardDeleteMutation.mutate(teacher.id) : undefined}
        softDeleteDescription="The teacher's account is deactivated and hidden from active lists."
        hardDeleteDescription="This permanently removes the teacher's account and profile. Use only for erroneous entries."
        isDeleting={softDeleteMutation.isPending || hardDeleteMutation.isPending}
      />
    ),
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Teachers</h1>
        <p className="text-sm text-muted-foreground">Manage teacher accounts and profiles.</p>
      </div>

      <DataTable
        title="All teachers"
        description="Every teacher account in the institute."
        columns={[
          { key: "name", label: "Teacher" },
          { key: "employee_code", label: "Employee #" },
          { key: "designation", label: "Designation" },
          { key: "status", label: "Status" },
          { key: "active", label: "Account" },
          { key: "edit", label: "" },
          { key: "actions", label: "" },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error ? loginErrorMessage(query.error) : undefined}
        onRetry={() => query.refetch()}
        emptyMessage="No teachers yet."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by name, email, or employee code"
        page={page}
        limit={LIMIT}
        total={query.data?.meta.total ?? 0}
        onPageChange={setPage}
        onRowClick={(index) => {
          const rowTeacher = query.data?.items[index];
          if (rowTeacher) setDetailTeacherId(rowTeacher.id);
        }}
        toolbarActions={
          <TeacherFormDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4" aria-hidden="true" />
                Add teacher
              </Button>
            }
          />
        }
      />

      <TeacherDetailDialog
        teacherId={detailTeacherId}
        open={detailTeacherId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTeacherId(null);
        }}
      />
    </div>
  );
}
