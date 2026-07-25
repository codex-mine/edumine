"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardSidebar, MobileSidebarDrawer } from "@/components/layout/dashboard-sidebar";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { LoadingState } from "@/components/shared/loading-state";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { isRole, roleCanAccess } from "@/lib/auth/roles";
import { useAuth } from "@/providers/auth-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobileNavOpen(false), [pathname]);

  if (isLoading || !user) {
    return <LoadingState label="Checking your session..." />;
  }

  const segment = pathname.split("/")[1] ?? "";
  const requiredRole = isRole(segment) ? segment : null;
  const allowed = requiredRole === null || roleCanAccess(user.role, requiredRole);

  return (
    <div className="flex min-h-full flex-1 bg-background">
      <DashboardSidebar role={user.role} />
      <MobileSidebarDrawer role={user.role} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {allowed ? children : <PermissionDenied userRole={user.role} requiredRole={requiredRole ?? undefined} />}
        </main>
      </div>
    </div>
  );
}
