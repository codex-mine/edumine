"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";

export function AuthStatus() {
  const router = useRouter();
  const { user, isLoading, logout, isLoggingOut } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {user.full_name} <span className="text-xs uppercase">({user.role})</span>
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={isLoggingOut}
        onClick={async () => {
          await logout();
          router.replace("/login");
        }}
      >
        <LogOut aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );
}
