"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { LoadingState } from "@/components/shared/loading-state";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { useAuth } from "@/providers/auth-provider";

function ForbiddenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <LoadingState label="Checking your session..." />;
  }

  return <PermissionDenied userRole={user.role} requiredRole={searchParams.get("required") ?? undefined} />;
}

export default function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<LoadingState label="Loading..." />}>
          <ForbiddenContent />
        </Suspense>
      </div>
    </div>
  );
}
