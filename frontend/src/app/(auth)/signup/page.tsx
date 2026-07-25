"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SignupForm } from "@/components/auth/signup-form";
import { useAuth } from "@/providers/auth-provider";

export default function SignupPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.role}`);
    }
  }, [isLoading, user, router]);

  return <SignupForm />;
}
