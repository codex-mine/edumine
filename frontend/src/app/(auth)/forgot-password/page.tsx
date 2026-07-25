"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { useAuth } from "@/providers/auth-provider";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.role}`);
    }
  }, [isLoading, user, router]);

  return <ForgotPasswordForm />;
}
