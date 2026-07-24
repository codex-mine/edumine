"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

import { DashboardNav } from "@/components/layout/dashboard-nav";
import { LoadingState } from "@/components/shared/loading-state";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { isRole, roleCanAccess } from "@/lib/auth/roles";
import { useAuth } from "@/providers/auth-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <LoadingState label="Checking your session..." />;
  }

  const segment = pathname.split("/")[1] ?? "";
  const requiredRole = isRole(segment) ? segment : null;
  const allowed = requiredRole === null || roleCanAccess(user.role, requiredRole);

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <DashboardNav role={user.role} />
      <div className="flex flex-1 items-start justify-center p-4 md:p-6">
        {allowed ? children : <PermissionDenied userRole={user.role} requiredRole={requiredRole ?? undefined} />}
      </div>
    </div>
  );
}
