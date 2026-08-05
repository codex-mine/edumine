import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Banknote,
  BookMarked,
  BookOpen,
  Boxes,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileQuestion,
  FileText,
  GraduationCap,
  HeartHandshake,
  Hourglass,
  KeyRound,
  Layers,
  LayoutDashboard,
  Megaphone,
  Receipt,
  ScanLine,
  ScrollText,
  UserCircle,
  UserCog,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";

import type { Role } from "@/lib/auth/roles";

/** A node in the sidebar tree. Leaves carry an `href`; branches carry
 * `children` and expand in place instead of navigating. Nesting is recursive —
 * later phases can deepen a branch without touching the renderer. */
export interface NavNode {
  label: string;
  icon: LucideIcon;
  /** Leaf destination. Omitted on branch nodes. */
  href?: string;
  /** Highlight only on an exact pathname match. Use for section landing pages
   * whose href is a prefix of their siblings' (e.g. `/admin/omr`). */
  exact?: boolean;
  children?: NavNode[];
}

/** Retained for callers that only deal with linkable items. */
export type NavItem = NavNode & { href: string };

export interface NavGroup {
  label: string;
  items: NavNode[];
}

/* ------------------------------------------------------------------ *
 * Shared branches — Admin and Principal render the same /admin/* pages
 * (Principal reaches them through the role-bypass in roleCanAccess), so
 * their subtrees are defined once and reused.
 * ------------------------------------------------------------------ */

const PEOPLE_BRANCH: NavNode = {
  label: "Users",
  icon: UsersRound,
  children: [
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Teachers", href: "/admin/teachers", icon: GraduationCap },
    { label: "Guardians", href: "/admin/guardians", icon: HeartHandshake },
    { label: "Staff & Accounts", href: "/admin/accounts", icon: UserCog },
  ],
};

const ACADEMICS_BRANCH: NavNode = {
  label: "Academics",
  icon: BookOpen,
  children: [
    { label: "Academic Years", href: "/admin/academic/years", icon: CalendarRange },
    { label: "Classes & Subjects", href: "/admin/academic/structure", icon: BookMarked },
    { label: "Sections & Assignment", href: "/admin/academic/sections", icon: DoorOpen },
    { label: "Enrollment & Promotion", href: "/admin/academic/enrollment", icon: ClipboardList },
    { label: "Routine Builder", href: "/admin/academic/routine", icon: CalendarClock },
    { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  ],
};

const EXAMS_BRANCH: NavNode = {
  label: "Exams",
  icon: ClipboardList,
  children: [
    { label: "All Exams", href: "/admin/exams", icon: ClipboardList, exact: true },
    { label: "Extension Requests", href: "/admin/exams/extension-requests", icon: Hourglass },
  ],
};

const OMR_BRANCH: NavNode = {
  label: "OMR Scanning",
  icon: ScanLine,
  children: [
    { label: "Scan Batches", href: "/admin/omr", icon: Layers, exact: true },
    { label: "Answer Keys", href: "/admin/omr/answer-keys", icon: KeyRound },
  ],
};

const FINANCE_BRANCH: NavNode = {
  label: "Finance",
  icon: Wallet,
  children: [
    {
      label: "Billing & Fees",
      icon: Wallet,
      children: [
        { label: "Overview", href: "/admin/billing", icon: Wallet, exact: true },
        { label: "Invoices", href: "/admin/billing/invoices", icon: FileText },
      ],
    },
    {
      label: "HR & Payroll",
      icon: Banknote,
      children: [
        { label: "Overview", href: "/admin/payroll", icon: Banknote, exact: true },
        { label: "Payroll Runs", href: "/admin/payroll/runs", icon: ScrollText },
      ],
    },
    { label: "Expenses", href: "/admin/expenses", icon: Receipt },
  ],
};

const OPERATIONS_BRANCH: NavNode = {
  label: "Operations",
  icon: Boxes,
  children: [
    { label: "Assets", href: "/admin/assets", icon: Archive },
    { label: "Communication", href: "/admin/communication", icon: Megaphone },
  ],
};

/** Each role's permitted navigation tree, grouped into sidebar sections.
 * Groups are the top-level captions; branches inside them expand into nested
 * submenus. Later phases append here per-role without touching the gating
 * mechanism (`roleCanAccess`). */
export const NAV_GROUPS: Record<Role, NavGroup[]> = {
  principal: [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "/principal", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Management",
      items: [
        PEOPLE_BRANCH,
        ACADEMICS_BRANCH,
        {
          label: "Examinations",
          icon: FileQuestion,
          children: [
            EXAMS_BRANCH,
            { label: "Results Approval", href: "/principal/results", icon: ScrollText },
            OMR_BRANCH,
          ],
        },
        FINANCE_BRANCH,
        OPERATIONS_BRANCH,
      ],
    },
  ],
  admin: [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Management",
      items: [
        PEOPLE_BRANCH,
        ACADEMICS_BRANCH,
        {
          label: "Examinations",
          icon: FileQuestion,
          children: [
            EXAMS_BRANCH,
            { label: "Results", href: "/admin/results", icon: ScrollText },
            OMR_BRANCH,
          ],
        },
        FINANCE_BRANCH,
        OPERATIONS_BRANCH,
      ],
    },
  ],
  teacher: [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "/teacher", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Teaching",
      items: [
        { label: "My Schedule", href: "/teacher/routine", icon: CalendarClock },
        { label: "Class Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
        {
          label: "Examinations",
          icon: FileQuestion,
          children: [
            { label: "Exam Questions", href: "/teacher/exams", icon: ClipboardList },
            { label: "Marks Entry", href: "/teacher/results", icon: ScrollText },
            {
              label: "OMR Scanning",
              icon: ScanLine,
              children: [
                { label: "Scan Batches", href: "/teacher/omr", icon: Layers, exact: true },
                { label: "Answer Keys", href: "/teacher/omr/answer-keys", icon: KeyRound },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Communication", href: "/teacher/communication", icon: Megaphone },
        { label: "My Profile", href: "/teacher/profile", icon: UserCircle },
      ],
    },
  ],
  accountant: [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "/accountant", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Finance",
      items: [
        {
          label: "Billing & Fees",
          icon: Wallet,
          children: [
            { label: "Overview", href: "/accountant/billing", icon: Wallet, exact: true },
            { label: "Invoices", href: "/accountant/billing/invoices", icon: FileText },
          ],
        },
        {
          label: "HR & Payroll",
          icon: Banknote,
          children: [
            { label: "Overview", href: "/accountant/payroll", icon: Banknote, exact: true },
            { label: "Payroll Runs", href: "/accountant/payroll/runs", icon: ScrollText },
          ],
        },
        { label: "Expenses", href: "/accountant/expenses", icon: Receipt },
      ],
    },
    {
      label: "Account",
      items: [{ label: "My Profile", href: "/accountant/profile", icon: UserCircle }],
    },
  ],
  receptionist: [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "/receptionist", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Front Desk",
      items: [
        { label: "Billing & Fees", href: "/receptionist/billing", icon: Wallet },
        { label: "Communication", href: "/receptionist/communication", icon: Megaphone },
      ],
    },
    {
      label: "Account",
      items: [{ label: "My Profile", href: "/receptionist/profile", icon: UserCircle }],
    },
  ],
  staff: [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "/staff", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Workspace",
      items: [
        { label: "My Attendance", href: "/staff/attendance", icon: ClipboardCheck },
        { label: "Assets", href: "/staff/assets", icon: Archive },
        { label: "Communication", href: "/staff/communication", icon: Megaphone },
      ],
    },
    {
      label: "Account",
      items: [{ label: "My Profile", href: "/staff/profile", icon: UserCircle }],
    },
  ],
  student: [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "/student", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "My Academics",
      items: [
        { label: "My Routine", href: "/student/routine", icon: CalendarClock },
        { label: "My Attendance", href: "/student/attendance", icon: ClipboardCheck },
        { label: "My Results", href: "/student/results", icon: ScrollText },
      ],
    },
    {
      label: "My Account",
      items: [
        { label: "My Billing", href: "/student/billing", icon: Wallet },
        { label: "Communication", href: "/student/communication", icon: Megaphone },
        { label: "My Profile", href: "/student/profile", icon: UserCircle },
      ],
    },
  ],
  guardian: [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "/guardian", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "My Children",
      items: [
        { label: "Routines", href: "/guardian/routine", icon: CalendarClock },
        { label: "Attendance", href: "/guardian/attendance", icon: ClipboardCheck },
        { label: "Results", href: "/guardian/results", icon: ScrollText },
        { label: "Billing", href: "/guardian/billing", icon: Wallet },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Communication", href: "/guardian/communication", icon: Megaphone },
        { label: "My Profile", href: "/guardian/profile", icon: UserCircle },
      ],
    },
  ],
};

/** True when `pathname` is the node's own page (or, for non-exact nodes, a page
 * nested beneath it). Shared by the sidebar's leaf highlighting and its
 * auto-expansion of ancestor branches. */
export function isNodeActive(node: NavNode, pathname: string): boolean {
  if (!node.href) return false;
  if (node.exact) return pathname === node.href;
  return pathname === node.href || pathname.startsWith(`${node.href}/`);
}

/** True when the node or anything below it matches `pathname`. */
export function containsActive(node: NavNode, pathname: string): boolean {
  if (isNodeActive(node, pathname)) return true;
  return (node.children ?? []).some((child) => containsActive(child, pathname));
}
