"use client";

import { Bell, LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/providers/auth-provider";

const ROLE_LABELS: Record<string, string> = {
  principal: "Principal",
  admin: "Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  receptionist: "Receptionist",
  staff: "Staff",
  student: "Student",
  guardian: "Guardian",
};

export function DashboardTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { user, logout, isLoggingOut } = useAuth();

  if (!user) return null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
          >
            <Menu className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open menu</TooltipContent>
      </Tooltip>

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          <BreadcrumbItem>Dashboard</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{ROLE_LABELS[user.role] ?? user.role}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex shrink-0 items-center gap-2">
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Notifications">
                  <Bell className="size-4" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
          <PopoverContent>
            <div className="border-b border-border px-3 py-2 text-sm font-semibold">Notifications</div>
            <div className="p-2">
              <EmptyState message="No notifications yet." />
            </div>
          </PopoverContent>
        </Popover>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Avatar className="size-7">
                <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{user.full_name}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">{user.full_name}</span>
              <Badge variant="muted" className="w-fit">
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isLoggingOut}
              onSelect={async (event) => {
                event.preventDefault();
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
