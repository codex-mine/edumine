"use client";

import { useState } from "react";
import { Plus, Receipt } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { FeeTypeFormDialog } from "@/components/modules/billing/fee-type-form-dialog";
import { FeeStructurePanel } from "@/components/modules/billing/fee-structure-panel";
import { GenerateInvoiceDialog } from "@/components/modules/billing/generate-invoice-dialog";
import { GenerateClassInvoicesDialog } from "@/components/modules/billing/generate-class-invoices-dialog";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useActiveAcademicYearQuery } from "@/hooks/use-academic";
import { useDeleteFeeTypeMutation, useFeeTypesQuery } from "@/hooks/use-billing";

export function BillingWorkspace({ invoiceListPath }: { invoiceListPath: string }) {
  const [feeTypeSearch, setFeeTypeSearch] = useState("");
  const activeYearQuery = useActiveAcademicYearQuery();
  const feeTypesQuery = useFeeTypesQuery();
  const deleteFeeTypeMutation = useDeleteFeeTypeMutation();

  const feeTypes = (feeTypesQuery.data ?? []).filter((f) =>
    f.name.toLowerCase().includes(feeTypeSearch.toLowerCase())
  );

  const feeTypeRows = feeTypes.map((feeType) => ({
    name: <span className="font-medium text-foreground">{feeType.name}</span>,
    recurring: feeType.is_recurring ? "Recurring" : "One-time",
    edit: (
      <FeeTypeFormDialog
        feeType={feeType}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onSoftDelete={() => deleteFeeTypeMutation.mutate(feeType.id)}
        softDeleteDescription="This fee type is hidden from active lists. Existing invoices referencing it are unaffected."
        isDeleting={deleteFeeTypeMutation.isPending}
      />
    ),
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Billing &amp; fees</h1>
        <p className="text-sm text-muted-foreground">
          Manage fee types, class fee structures, and generate student invoices.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GenerateInvoiceDialog
          academicYearId={activeYearQuery.data?.id}
          trigger={
            <Button  >
              <Receipt className="size-8" aria-hidden="true" />
              Generate invoice
            </Button>
          }
        />
        <GenerateClassInvoicesDialog
          academicYearId={activeYearQuery.data?.id}
          trigger={
            <Button   variant="outline">
              <Receipt className="size-8" aria-hidden="true" />
              Generate for a class
            </Button>
          }
        />
        <Button asChild   variant="outline">
          <Link href={invoiceListPath}>View all invoices</Link>
        </Button>
      </div>

      {activeYearQuery.isError && (
        <p className="text-sm text-muted-foreground">
          No active academic year — invoice generation requires one to be set up under Academics.
        </p>
      )}

      <DataTable
        title="Fee types"
        description="Master fee list — admission, session, monthly tuition, sports, or custom fees."
        columns={[
          { key: "name", label: "Fee type" },
          { key: "recurring", label: "Billing" },
          { key: "edit", label: "" },
          { key: "actions", label: "" },
        ]}
        rows={feeTypeRows}
        isLoading={feeTypesQuery.isLoading}
        isError={feeTypesQuery.isError}
        errorMessage={feeTypesQuery.error ? loginErrorMessage(feeTypesQuery.error) : undefined}
        onRetry={() => feeTypesQuery.refetch()}
        emptyMessage="No fee types defined yet."
        searchValue={feeTypeSearch}
        onSearchChange={setFeeTypeSearch}
        searchPlaceholder="Search fee types"
        page={1}
        limit={Math.max(feeTypeRows.length, 1)}
        total={feeTypeRows.length}
        onPageChange={() => {}}
        toolbarActions={
          <FeeTypeFormDialog
            trigger={
              <Button  >
                <Plus className="size-8" aria-hidden="true" />
                Add fee type
              </Button>
            }
          />
        }
      />

      <FeeStructurePanel defaultAcademicYearId={activeYearQuery.data?.id} />
    </div>
  );
}
