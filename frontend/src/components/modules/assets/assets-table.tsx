"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { EditAssetDialog } from "@/components/modules/assets/edit-asset-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAssetsQuery } from "@/hooks/use-assets";
import { ASSET_CONDITION_LABELS, type AssetCondition } from "@/lib/api/assets";

const CONDITION_BADGE_VARIANT: Record<AssetCondition, "success" | "warning" | "destructive" | "muted" | "info"> = {
  new: "info",
  good: "success",
  fair: "warning",
  damaged: "destructive",
  disposed: "muted",
};

const CONDITION_OPTIONS: AssetCondition[] = ["new", "good", "fair", "damaged", "disposed"];

export function AssetsTable({ basePath, canManage }: { basePath: string; canManage: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState<AssetCondition | "all">("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const assetsQuery = useAssetsQuery({
    condition: condition === "all" ? undefined : condition,
    search: search || undefined,
    page,
    limit,
  });
  const items = assetsQuery.data?.items ?? [];

  const rows = items.map((asset) => ({
    name: <span className="font-medium text-foreground">{asset.name}</span>,
    category: asset.category_name,
    location: asset.room_name ?? <span className="text-muted-foreground">Unassigned</span>,
    quantity: String(asset.quantity),
    condition: (
      <Badge variant={CONDITION_BADGE_VARIANT[asset.condition]}>{ASSET_CONDITION_LABELS[asset.condition]}</Badge>
    ),
    actions: canManage ? (
      <EditAssetDialog
        asset={asset}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ) : null,
  }));

  return (
    <DataTable
      title="Assets"
      description="Registered institutional assets by category and location."
      columns={[
        { key: "name", label: "Asset" },
        { key: "category", label: "Category" },
        { key: "location", label: "Location" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "condition", label: "Condition" },
        ...(canManage ? [{ key: "actions", label: "" }] : []),
      ]}
      rows={rows}
      isLoading={assetsQuery.isLoading}
      isError={assetsQuery.isError}
      errorMessage={assetsQuery.error ? loginErrorMessage(assetsQuery.error) : undefined}
      onRetry={() => assetsQuery.refetch()}
      emptyMessage="No assets registered yet."
      searchValue={search}
      onSearchChange={(value) => {
        setSearch(value);
        setPage(1);
      }}
      searchPlaceholder="Search by asset name"
      page={page}
      limit={limit}
      total={assetsQuery.data?.meta.total ?? 0}
      onPageChange={setPage}
      onRowClick={(index) => router.push(`${basePath}/${items[index].id}`)}
      toolbarActions={
        <Select
          value={condition}
          onValueChange={(value) => {
            setCondition(value as AssetCondition | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[10rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All conditions</SelectItem>
            {CONDITION_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {ASSET_CONDITION_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
