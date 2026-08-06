"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { UserAccountDetailDialog } from "@/components/modules/people/user-account-detail-dialog";
import { UserAccountFormDialog } from "@/components/modules/people/user-account-form-dialog";
import { ActiveBadge } from "@/components/modules/people/status-badge";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useHardDeleteUserAccountMutation, useSoftDeleteUserAccountMutation, useUserAccountsQuery } from "@/hooks/use-users";
import type { UserAccountRole } from "@/lib/api/users";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

const LIMIT = 20;

const TABS: { value: UserAccountRole | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "receptionist", label: "Receptionist" },
];

export default function AdminAccountsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<UserAccountRole | "all">("all");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const visibleTabs = user?.role === "principal" ? TABS : TABS.filter((t) => t.value !== "admin");

  const query = useUserAccountsQuery({
    page,
    limit: LIMIT,
    search: search || undefined,
    role: tab === "all" ? undefined : tab,
  });
  const softDeleteMutation = useSoftDeleteUserAccountMutation();
  const hardDeleteMutation = useHardDeleteUserAccountMutation();

  const rows = (query.data?.items ?? []).map((account) => ({
    name: (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{account.full_name}</span>
        <span className="text-xs text-muted-foreground">{account.email ?? account.phone}</span>
      </div>
    ),
    role: <span className="capitalize">{account.role}</span>,
    designation: account.designation ?? "—",
    active: <ActiveBadge isActive={account.is_active} />,
    edit: (
      <UserAccountFormDialog
        account={account}
        currentUserRole={user?.role ?? "admin"}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            disabled={account.role === "admin" && user?.role !== "principal"}
          >
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onView={() => router.push(`/admin/accounts/${account.id}`)}
        onSoftDelete={
          account.role === "admin" && user?.role !== "principal"
            ? undefined
            : () => softDeleteMutation.mutate(account.id)
        }
        onHardDelete={user?.role === "principal" ? () => hardDeleteMutation.mutate(account.id) : undefined}
        softDeleteDescription="This account is deactivated and hidden from active lists."
        hardDeleteDescription="This permanently removes the account and profile. Use only for erroneous entries."
        isDeleting={softDeleteMutation.isPending || hardDeleteMutation.isPending}
      />
    ),
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Staff &amp; accounts</h1>
        <p className="text-sm text-muted-foreground">
          {user?.role === "principal"
            ? "Manage Admin, Staff, Accountant, and Receptionist accounts."
            : "Manage Staff, Accountant, and Receptionist accounts."}
        </p>
      </div>

      <div className="flex gap-1 rounded bg-muted p-1 w-fit border ">
        {visibleTabs.map((t) => (
          <Button
            variant={tab === t.value ? "default" : "ghost"}

            key={t.value}
            onClick={() => {
              setTab(t.value);
              setPage(1);
            }}
         
          >
            {t.label}
          </Button>
        ))}
      </div>

      <DataTable
        title="Accounts"
        description="Admin, Staff, Accountant, and Receptionist accounts."
        columns={[
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
          { key: "designation", label: "Designation" },
          { key: "active", label: "Account" },
          { key: "edit", label: "" },
          { key: "actions", label: "" },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error ? loginErrorMessage(query.error) : undefined}
        onRetry={() => query.refetch()}
        emptyMessage="No accounts found."
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
        onRowClick={(index) => {
          const rowAccount = query.data?.items[index];
          if (rowAccount) setDetailUserId(rowAccount.id);
        }}
        toolbarActions={
          <UserAccountFormDialog
            currentUserRole={user?.role ?? "admin"}
            trigger={
              <Button  >
                <Plus className="size-8" aria-hidden="true" />
                Add account
              </Button>
            }
          />
        }
      />

      <UserAccountDetailDialog
        userId={detailUserId}
        open={detailUserId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailUserId(null);
        }}
      />
    </div>
  );
}
