"use client";

import { AssetWorkspace } from "@/components/modules/assets/asset-workspace";
import { useAuth } from "@/providers/auth-provider";

export default function AdminAssetsPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  return <AssetWorkspace basePath="/admin/assets" canManage={permissions.includes("assets.manage")} />;
}
