"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { AssetCategoryFormDialog } from "@/components/modules/assets/asset-category-form-dialog";
import { AssetsTable } from "@/components/modules/assets/assets-table";
import { RegisterAssetDialog } from "@/components/modules/assets/register-asset-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAssetCategoriesQuery } from "@/hooks/use-assets";

export function AssetWorkspace({ basePath, canManage }: { basePath: string; canManage: boolean }) {
  const [categorySearch, setCategorySearch] = useState("");
  const categoriesQuery = useAssetCategoriesQuery();

  const categories = (categoriesQuery.data ?? []).filter((category) =>
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const categoryRows = categories.map((category) => ({
    name: <span className="font-medium text-foreground">{category.name}</span>,
    edit: canManage ? (
      <AssetCategoryFormDialog
        category={category}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ) : null,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Asset management</h1>
        <p className="text-sm text-muted-foreground">
          Register institutional assets and track their condition, quantity, and location over time.
        </p>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <RegisterAssetDialog
            trigger={
              <Button  >
                <Plus className="size-8" aria-hidden="true" />
                Register asset
              </Button>
            }
          />
        </div>
      )}

      <DataTable
        title="Asset categories"
        description="Master category list used when registering assets."
        columns={[{ key: "name", label: "Category" }, ...(canManage ? [{ key: "edit", label: "" }] : [])]}
        rows={categoryRows}
        isLoading={categoriesQuery.isLoading}
        isError={categoriesQuery.isError}
        errorMessage={categoriesQuery.error ? loginErrorMessage(categoriesQuery.error) : undefined}
        onRetry={() => categoriesQuery.refetch()}
        emptyMessage="No asset categories defined yet."
        searchValue={categorySearch}
        onSearchChange={setCategorySearch}
        searchPlaceholder="Search categories"
        page={1}
        limit={Math.max(categoryRows.length, 1)}
        total={categoryRows.length}
        onPageChange={() => {}}
        toolbarActions={
          canManage ? (
            <AssetCategoryFormDialog
              trigger={
                <Button >
                  <Plus className="size-8" aria-hidden="true" />
                  Add category
                </Button>
              }
            />
          ) : undefined
        }
      />

      <AssetsTable basePath={basePath} canManage={canManage} />
    </div>
  );
}
