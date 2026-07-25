"use client";

import { GraduationCap, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/lib/auth/nav-config";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";
import Image from "next/image";

function SidebarContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = NAV_GROUPS[role];

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4 text-xl font-medium whitespace-nowrap text-sidebar-foreground my-4">
        <Image
          src="/logo.png"
          alt="Codex Edumine Logo"
          width={32}
          height={32}
          className="rounded"
        />
        <span>Codex Edumine</span>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="px-2.5 text-sm font-semibold text-sidebar-foreground/50 ">
              {group.label}
            </span>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded px-2.5 py-3 my-2  font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="size-8 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}

export function DashboardSidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-[14rem] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <SidebarContent role={role} />
    </aside>
  );
}

export function MobileSidebarDrawer({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-[16rem] max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-transform",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent role={role} onNavigate={() => onOpenChange(false)} />
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2.5 right-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => onOpenChange(false)}
          aria-label="Close navigation menu"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </aside>
    </div>
  );
}
