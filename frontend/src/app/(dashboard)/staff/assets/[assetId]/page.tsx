"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { AssetDetailView } from "@/components/modules/assets/asset-detail-view";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAssetQuery } from "@/hooks/use-assets";
import { useAuth } from "@/providers/auth-provider";

export default function StaffAssetDetailPage() {
  const params = useParams<{ assetId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const assetQuery = useAssetQuery(params.assetId);

  if (assetQuery.isLoading) return <LoadingState label="Loading asset..." />;
  if (assetQuery.isError || !assetQuery.data) {
    return <ErrorState message={loginErrorMessage(assetQuery.error)} onRetry={() => assetQuery.refetch()} />;
  }

  const permissions = user?.permissions ?? [];

  return (
    <div className="flex w-full flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/staff/assets")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to assets
      </Button>
      <AssetDetailView asset={assetQuery.data} canManage={permissions.includes("assets.manage")} />
    </div>
  );
}
