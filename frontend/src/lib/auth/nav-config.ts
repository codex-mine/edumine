import type { LucideIcon } from "lucide-react";
import { GraduationCap, HeartHandshake, LayoutDashboard, UserCircle, UserCog, Users } from "lucide-react";

import type { Role } from "@/lib/auth/roles";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Each role's permitted navigation items. Phase 4 (People & Identity Management)
 * adds people-management routes for Admin/Principal (served from the shared
 * /admin/* pages — Principal reaches them via the existing role-bypass in
 * roleCanAccess) and self-view profile routes for the remaining roles. Later
 * phases append here per-role without touching the gating mechanism. */
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  principal: [
    { label: "Dashboard", href: "/principal", icon: LayoutDashboard },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Teachers", href: "/admin/teachers", icon: GraduationCap },
    { label: "Guardians", href: "/admin/guardians", icon: HeartHandshake },
    { label: "Staff & Accounts", href: "/admin/accounts", icon: UserCog },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Teachers", href: "/admin/teachers", icon: GraduationCap },
    { label: "Guardians", href: "/admin/guardians", icon: HeartHandshake },
    { label: "Staff & Accounts", href: "/admin/accounts", icon: UserCog },
  ],
  teacher: [
    { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { label: "My Profile", href: "/teacher/profile", icon: UserCircle },
  ],
  accountant: [
    { label: "Dashboard", href: "/accountant", icon: LayoutDashboard },
    { label: "My Profile", href: "/accountant/profile", icon: UserCircle },
  ],
  receptionist: [
    { label: "Dashboard", href: "/receptionist", icon: LayoutDashboard },
    { label: "My Profile", href: "/receptionist/profile", icon: UserCircle },
  ],
  staff: [
    { label: "Dashboard", href: "/staff", icon: LayoutDashboard },
    { label: "My Profile", href: "/staff/profile", icon: UserCircle },
  ],
  student: [
    { label: "Dashboard", href: "/student", icon: LayoutDashboard },
    { label: "My Profile", href: "/student/profile", icon: UserCircle },
  ],
  guardian: [
    { label: "Dashboard", href: "/guardian", icon: LayoutDashboard },
    { label: "My Profile", href: "/guardian/profile", icon: UserCircle },
  ],
};

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar groups the design system's shell expects (ui-design.md section 4.1).
 * Every role has one "Overview" group today; later phases add groups (Academics,
 * Finance, ...) alongside NAV_ITEMS without changing the sidebar component. */
export const NAV_GROUPS: Record<Role, NavGroup[]> = Object.fromEntries(
  Object.entries(NAV_ITEMS).map(([role, items]) => [role, [{ label: "Overview", items }]])
) as Record<Role, NavGroup[]>;
