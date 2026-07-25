"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/providers/auth-provider";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.role}`);
    }
  }, [isLoading, user, router]);

  return <ResetPasswordForm token={searchParams.get("token")} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading..." />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
