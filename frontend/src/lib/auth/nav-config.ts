import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileQuestion,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  ScrollText,
  UserCircle,
  UserCog,
  Users,
} from "lucide-react";

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
    { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
    { label: "Exams", href: "/admin/exams", icon: FileQuestion },
    { label: "Results Approval", href: "/principal/results", icon: ScrollText },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Teachers", href: "/admin/teachers", icon: GraduationCap },
    { label: "Guardians", href: "/admin/guardians", icon: HeartHandshake },
    { label: "Staff & Accounts", href: "/admin/accounts", icon: UserCog },
    { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
    { label: "Exams", href: "/admin/exams", icon: FileQuestion },
    { label: "Results", href: "/admin/results", icon: ScrollText },
  ],
  teacher: [
    { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { label: "My Schedule", href: "/teacher/routine", icon: CalendarClock },
    { label: "Class Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
    { label: "Exam Questions", href: "/teacher/exams", icon: FileQuestion },
    { label: "Marks Entry", href: "/teacher/results", icon: ScrollText },
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
    { label: "My Attendance", href: "/staff/attendance", icon: ClipboardCheck },
    { label: "My Profile", href: "/staff/profile", icon: UserCircle },
  ],
  student: [
    { label: "Dashboard", href: "/student", icon: LayoutDashboard },
    { label: "My Routine", href: "/student/routine", icon: CalendarClock },
    { label: "My Attendance", href: "/student/attendance", icon: ClipboardCheck },
    { label: "My Results", href: "/student/results", icon: ScrollText },
    { label: "My Profile", href: "/student/profile", icon: UserCircle },
  ],
  guardian: [
    { label: "Dashboard", href: "/guardian", icon: LayoutDashboard },
    { label: "Children's Routines", href: "/guardian/routine", icon: CalendarClock },
    { label: "Children's Attendance", href: "/guardian/attendance", icon: ClipboardCheck },
    { label: "Children's Results", href: "/guardian/results", icon: ScrollText },
    { label: "My Profile", href: "/guardian/profile", icon: UserCircle },
  ],
};

/** Phase 5 (Academic Structure Management) — Admin/Principal only. Principal
 * reaches these via the same shared /admin/academic/* pages, through the
 * existing role-bypass in roleCanAccess. */
const ACADEMIC_NAV_ITEMS: NavItem[] = [
  { label: "Academic Years", href: "/admin/academic/years", icon: CalendarRange },
  { label: "Classes & Subjects", href: "/admin/academic/structure", icon: BookMarked },
  { label: "Sections & Assignment", href: "/admin/academic/sections", icon: DoorOpen },
  { label: "Enrollment & Promotion", href: "/admin/academic/enrollment", icon: ClipboardList },
  { label: "Routine Builder", href: "/admin/academic/routine", icon: CalendarClock },
];

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar groups the design system's shell expects (ui-design.md section 4.1).
 * Most roles have a single "Overview" group; Admin/Principal additionally get
 * an "Academics" group. Later phases append further groups the same way. */
export const NAV_GROUPS: Record<Role, NavGroup[]> = Object.fromEntries(
  Object.entries(NAV_ITEMS).map(([role, items]) => [
    role,
    role === "admin" || role === "principal"
      ? [
          { label: "Overview", items },
          { label: "Academics", items: ACADEMIC_NAV_ITEMS },
        ]
      : [{ label: "Overview", items }],
  ])
) as Record<Role, NavGroup[]>;
