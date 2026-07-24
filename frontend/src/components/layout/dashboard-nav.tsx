"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/auth/nav-config";
import type { Role } from "@/lib/auth/roles";

export function DashboardNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];

  return (
    <nav className="flex w-full shrink-0 flex-row gap-1 border-b bg-card p-2 md:w-56 md:flex-col md:border-b-0 md:border-r md:p-3">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
