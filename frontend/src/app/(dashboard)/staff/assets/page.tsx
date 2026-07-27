"use client";

import { AssetWorkspace } from "@/components/modules/assets/asset-workspace";
import { useAuth } from "@/providers/auth-provider";

export default function StaffAssetsPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  return <AssetWorkspace basePath="/staff/assets" canManage={permissions.includes("assets.manage")} />;
}
