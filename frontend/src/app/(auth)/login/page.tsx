"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/providers/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.role}`);
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    return <LoadingState label="Checking your session..." />;
  }

  return <LoginForm />;
}
