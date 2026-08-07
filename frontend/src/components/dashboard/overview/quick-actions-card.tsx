"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, ClipboardList, FileBarChart, GraduationCap, Layers, UserPlus } from "lucide-react";

import { SectionCard } from "@/components/dashboard/overview/section-card";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "info" | "destructive";
}

const TONE_CLASSES: Record<QuickAction["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
};

/** Admin and Principal share the /admin/* management pages (Principal reaches
 * them through the role bypass), so one set of destinations serves both. */
export function quickActionsFor(role: "admin" | "principal"): QuickAction[] {
  return [
    { label: "Add Student", href: "/admin/students", icon: UserPlus, tone: "primary" },
    { label: "Add Teacher", href: "/admin/teachers", icon: GraduationCap, tone: "destructive" },
    { label: "Add Subject", href: "/admin/academic/structure", icon: Layers, tone: "success" },
    { label: "Create Class", href: "/admin/academic/sections", icon: ClipboardList, tone: "warning" },
    { label: "Take Attendance", href: "/admin/attendance", icon: CalendarCheck, tone: "info" },
    {
      label: "Results",
      href: role === "principal" ? "/principal/results" : "/admin/results",
      icon: FileBarChart,
      tone: "primary",
    },
  ];
}

export function QuickActionsCard({ role }: { role: "admin" | "principal" }) {
  const actions = quickActionsFor(role);

  return (
    <SectionCard title="Quick Actions">
      <div className="grid grid-cols-3 gap-4">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-3 rounded border border-border px-2 py-6 text-center transition-colors hover:border-primary/40 hover:bg-muted"
          >
            <span
              className={cn(
                "flex size-16 items-center justify-center rounded",
                TONE_CLASSES[action.tone]
              )}
            >
              <action.icon className="size-8" aria-hidden="true" />
            </span>
            <span className="text-xs leading-tight font-medium text-foreground">{action.label}</span>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}
