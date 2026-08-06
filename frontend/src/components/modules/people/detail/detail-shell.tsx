"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Label/value row — same shape the *-detail-dialog components use, so a record
 * reads identically whether it is peeked at in a dialog or opened in full. */
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function DetailPageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  meta,
  actions,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {meta && <div className="mt-1 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions}
      </div>
    </div>
  );
}

export interface DetailTab {
  value: string;
  label: string;
}

export function DetailTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex w-fit max-w-full flex-wrap gap-1 rounded border bg-muted p-1">
      {tabs.map((tab) => (
        <Button
          key={tab.value}
          variant={value === tab.value ? "default" : "ghost"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

/** Single headline number. `tone` tints the value for at-a-glance reading —
 * outstanding dues in red, healthy attendance in green. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "negative";
}) {
  return (
    <Card className="gap-0 p-4">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "default" && "text-foreground",
          tone === "positive" && "text-success",
          tone === "warning" && "text-warning",
          tone === "negative" && "text-destructive"
        )}
      >
        {value}
      </span>
      {hint && <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span>}
    </Card>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function DetailSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions}
        </div>
      </CardHeader>
      <div className="px-4 pb-4">{children}</div>
    </Card>
  );
}

/** Plain table for the read-only panels. DataTable carries search and paging
 * this view has no use for, so these panels render a bare table instead. */
export function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex}>
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
