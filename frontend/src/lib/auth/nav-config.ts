import type { LucideIcon } from "lucide-react";
import { LayoutDashboard } from "lucide-react";

import type { Role } from "@/lib/auth/roles";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Each role's permitted navigation items. Phase 3 ships only the dashboard shell,
 * so every role has exactly one real destination today; later phases append here
 * as their modules land, per-role, without touching the gating mechanism. */
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  principal: [{ label: "Dashboard", href: "/principal", icon: LayoutDashboard }],
  admin: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  teacher: [{ label: "Dashboard", href: "/teacher", icon: LayoutDashboard }],
  accountant: [{ label: "Dashboard", href: "/accountant", icon: LayoutDashboard }],
  receptionist: [{ label: "Dashboard", href: "/receptionist", icon: LayoutDashboard }],
  staff: [{ label: "Dashboard", href: "/staff", icon: LayoutDashboard }],
  student: [{ label: "Dashboard", href: "/student", icon: LayoutDashboard }],
  guardian: [{ label: "Dashboard", href: "/guardian", icon: LayoutDashboard }],
};
