"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { GuardianFormDialog } from "@/components/modules/people/guardian-form-dialog";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { ActiveBadge } from "@/components/modules/people/status-badge";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useGuardiansQuery, useHardDeleteGuardianMutation, useSoftDeleteGuardianMutation } from "@/hooks/use-guardians";
import { useAuth } from "@/providers/auth-provider";

const LIMIT = 20;

export default function AdminGuardiansPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const query = useGuardiansQuery({ page, limit: LIMIT, search: search || undefined });
  const softDeleteMutation = useSoftDeleteGuardianMutation();
  const hardDeleteMutation = useHardDeleteGuardianMutation();

  const rows = (query.data?.items ?? []).map((guardian) => ({
    name: (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{guardian.full_name}</span>
        <span className="text-xs text-muted-foreground">{guardian.phone}</span>
      </div>
    ),
    occupation: guardian.occupation ?? "—",
    active: <ActiveBadge isActive={guardian.is_active} />,
    edit: (
      <GuardianFormDialog
        guardian={guardian}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onSoftDelete={() => softDeleteMutation.mutate(guardian.id)}
        onHardDelete={user?.role === "principal" ? () => hardDeleteMutation.mutate(guardian.id) : undefined}
        softDeleteDescription="The guardian's account is deactivated and hidden from active lists. Existing student links are preserved."
        hardDeleteDescription="This permanently removes the guardian's account and profile. Use only for erroneous entries."
        isDeleting={softDeleteMutation.isPending || hardDeleteMutation.isPending}
      />
    ),
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Guardians</h1>
        <p className="text-sm text-muted-foreground">
          Manage guardian accounts. Link guardians to students from the Students page.
        </p>
      </div>

      <DataTable
        title="All guardians"
        description="Every guardian account in the institute."
        columns={[
          { key: "name", label: "Guardian" },
          { key: "occupation", label: "Occupation" },
          { key: "active", label: "Account" },
          { key: "edit", label: "" },
          { key: "actions", label: "" },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error ? loginErrorMessage(query.error) : undefined}
        onRetry={() => query.refetch()}
        emptyMessage="No guardians yet."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by name, email, or phone"
        page={page}
        limit={LIMIT}
        total={query.data?.meta.total ?? 0}
        onPageChange={setPage}
        toolbarActions={
          <GuardianFormDialog
            trigger={
              <Button  >
                <Plus className="size-8" aria-hidden="true" />
                Add guardian
              </Button>
            }
          />
        }
      />
    </div>
  );
}
