import { GraduationCap } from "lucide-react";

import { AuthStatus } from "@/components/layout/auth-status";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2 font-medium">
          <GraduationCap className="size-5 text-primary" aria-hidden="true" />
          <span>Codex Edumine</span>
        </div>
        <div className="flex items-center gap-3">
          <AuthStatus />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
