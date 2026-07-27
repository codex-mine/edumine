"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { EditAssetDialog } from "@/components/modules/assets/edit-asset-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAssetLogsQuery } from "@/hooks/use-assets";
import { ASSET_CHANGE_TYPE_LABELS, ASSET_CONDITION_LABELS, type Asset, type AssetCondition } from "@/lib/api/assets";

const CONDITION_BADGE_VARIANT: Record<AssetCondition, "success" | "warning" | "destructive" | "muted" | "info"> = {
  new: "info",
  good: "success",
  fair: "warning",
  damaged: "destructive",
  disposed: "muted",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AssetDetailView({ asset, canManage }: { asset: Asset; canManage: boolean }) {
  const logsQuery = useAssetLogsQuery(asset.id);
  const logs = logsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{asset.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={CONDITION_BADGE_VARIANT[asset.condition]}>
                {ASSET_CONDITION_LABELS[asset.condition]}
              </Badge>
              {canManage && (
                <EditAssetDialog
                  asset={asset}
                  trigger={
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  }
                />
              )}
            </div>
          </div>
          <CardDescription>
            {asset.category_name} &middot; Qty {asset.quantity} &middot;{" "}
            {asset.room_name ?? "Unassigned location"}
            {asset.purchase_value != null && (
              <>
                {" "}
                &middot; Purchased{" "}
                {asset.purchase_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {asset.purchase_date && ` on ${asset.purchase_date}`}
              </>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change history</CardTitle>
          <CardDescription>Every quantity, condition, and location change recorded for this asset.</CardDescription>
        </CardHeader>

        {logsQuery.isLoading ? (
          <LoadingState label="Loading change history..." />
        ) : logsQuery.isError ? (
          <div className="px-4 pb-4">
            <ErrorState message={loginErrorMessage(logsQuery.error)} onRetry={() => logsQuery.refetch()} />
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState message="No changes recorded yet — updates to quantity, condition, or location will appear here." />
          </div>
        ) : (
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Change</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">From</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">To</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Updated by</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {ASSET_CHANGE_TYPE_LABELS[log.change_type]}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{log.previous_value ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground">{log.new_value ?? "—"}</td>
                    <td className="px-3 py-2">{log.updated_by_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
