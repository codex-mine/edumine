import {
  Award,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Clock,
  ClipboardCheck,
  FileText,
  ListChecks,
  PenSquare,
  Receipt,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/auth/roles";
import type { TableCardColumn } from "@/components/dashboard/table-card";

export interface StatDef {
  label: string;
  icon: LucideIcon;
  accent: "primary" | "success" | "warning" | "info";
}

export interface ChartDef {
  title: string;
  subtitle: string;
  type: "line" | "bar";
}

export interface ListDef {
  title: string;
  meta: string;
}

export interface TableDef {
  title: string;
  meta: string;
  columns: TableCardColumn[];
}

export interface RoleWidgets {
  description: string;
  stats: StatDef[];
  chart?: ChartDef;
  list?: ListDef;
  table?: TableDef;
}

/** Widget composition per role, matching docs/ui-design.md sections 6-7.
 * The backend's dashboard endpoints don't return real widget data yet, so
 * every stat/chart/list/table renders honest empty state until its module ships. */
export const ROLE_WIDGETS: Record<Role, RoleWidgets> = {
  principal: {
    description: "Institution-wide overview across academics, finance, and staff.",
    stats: [
      { label: "Total income (month)", icon: Wallet, accent: "success" },
      { label: "Total students", icon: Users, accent: "primary" },
      { label: "Total staff", icon: UserCog, accent: "info" },
      { label: "Dues outstanding", icon: Receipt, accent: "warning" },
    ],
    chart: { title: "Fee collection trend", subtitle: "Monthly collections vs. dues", type: "line" },
    table: {
      title: "Recent invoices",
      meta: "Latest billing activity across the institution",
      columns: [
        { key: "student", label: "Student" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "status", label: "Status" },
        { key: "due", label: "Due date", align: "right" },
      ],
    },
  },
  admin: {
    description: "Admissions, attendance, and billing at a glance.",
    stats: [
      { label: "New admissions", icon: UserPlus, accent: "primary" },
      { label: "Today's attendance", icon: CalendarCheck, accent: "success" },
      { label: "Pending approvals", icon: Clock, accent: "warning" },
      { label: "Today's collections", icon: Wallet, accent: "info" },
    ],
    chart: { title: "Attendance this week", subtitle: "Institution-wide attendance rate", type: "bar" },
    table: {
      title: "Today's attendance",
      meta: "Live roll call across classes",
      columns: [
        { key: "student", label: "Student" },
        { key: "class", label: "Class" },
        { key: "status", label: "Status" },
      ],
    },
  },
  teacher: {
    description: "Your classes, attendance, and marks entry for today.",
    stats: [
      { label: "Today's classes", icon: BookOpen, accent: "primary" },
      { label: "Attendance marked", icon: ClipboardCheck, accent: "success" },
      { label: "Pending marks entry", icon: PenSquare, accent: "warning" },
      { label: "Leave balance", icon: CalendarDays, accent: "info" },
    ],
    list: { title: "Today's schedule", meta: "Your classes for today" },
    table: {
      title: "Exam / marks status",
      meta: "Entry progress for your classes",
      columns: [
        { key: "exam", label: "Exam" },
        { key: "class", label: "Class" },
        { key: "status", label: "Status" },
      ],
    },
  },
  accountant: {
    description: "Collections, dues, and payments overview.",
    stats: [
      { label: "Today's collections", icon: Wallet, accent: "success" },
      { label: "Dues outstanding", icon: Receipt, accent: "warning" },
      { label: "Pending invoices", icon: FileText, accent: "info" },
    ],
    list: { title: "Recent payments", meta: "Latest recorded payments" },
    table: {
      title: "Outstanding dues",
      meta: "Students with unpaid balances",
      columns: [
        { key: "student", label: "Student" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "due", label: "Due date", align: "right" },
      ],
    },
  },
  receptionist: {
    description: "Front-desk collections and dues overview.",
    stats: [
      { label: "Today's collections", icon: Wallet, accent: "success" },
      { label: "Dues outstanding", icon: Receipt, accent: "warning" },
      { label: "Pending invoices", icon: FileText, accent: "info" },
    ],
    list: { title: "Recent payments", meta: "Latest recorded payments" },
    table: {
      title: "Outstanding dues",
      meta: "Students with unpaid balances",
      columns: [
        { key: "student", label: "Student" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "due", label: "Due date", align: "right" },
      ],
    },
  },
  staff: {
    description: "Your attendance, leave, and tasks.",
    stats: [
      { label: "Attendance", icon: CalendarCheck, accent: "success" },
      { label: "Leave balance", icon: CalendarDays, accent: "info" },
      { label: "Pending tasks", icon: ListChecks, accent: "warning" },
    ],
    list: { title: "Recent activity", meta: "Your latest actions" },
  },
  student: {
    description: "Your attendance, results, and upcoming exams.",
    stats: [
      { label: "Attendance", icon: CalendarCheck, accent: "success" },
      { label: "Current due", icon: Receipt, accent: "warning" },
      { label: "Latest result", icon: Award, accent: "primary" },
      { label: "Upcoming exam", icon: CalendarClock, accent: "info" },
    ],
    chart: { title: "Attendance trend", subtitle: "Your attendance over time", type: "line" },
  },
  guardian: {
    description: "Your linked child's attendance, results, and billing.",
    stats: [
      { label: "Attendance", icon: CalendarCheck, accent: "success" },
      { label: "Current due", icon: Receipt, accent: "warning" },
      { label: "Latest result", icon: Award, accent: "primary" },
      { label: "Upcoming exam", icon: CalendarClock, accent: "info" },
    ],
    chart: { title: "Attendance trend", subtitle: "Attendance over time", type: "line" },
  },
};
