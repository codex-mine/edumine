"use client";

import type { LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage, initials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** One label/value pair inside an info card. A null/undefined `value` still
 * renders its label with an em dash, so a sparse record keeps the same shape as
 * a complete one instead of reflowing the grid. */
export interface ProfileFieldSpec {
  label: string;
  value: React.ReactNode;
}

/** Identity block at the top of the profile: portrait, name, role, and the
 * tenure/status line, with the section tabs sitting on the card's bottom edge. */
export function ProfileIdentityCard({
  fullName,
  photoUrl,
  roleLabel,
  email,
  tenureLine,
  isActive,
  badges,
  actions,
  children,
}: {
  fullName: string;
  photoUrl?: string | null;
  roleLabel: string;
  email?: string | null;
  /** e.g. "Started on January 1, 2024 (2.5 years ago)" — omitted when unknown. */
  tenureLine?: string | null;
  isActive: boolean;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  /** The tab bar. Rendered flush against the bottom border, as in the design. */
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          {/* This project halves Tailwind's spacing scale (`--spacing`), so
              `size-*` values run double what they would elsewhere. */}
          <Avatar className="size-40 rounded-full ring-2 ring-border">
            {photoUrl ? <AvatarImage src={photoUrl} alt={fullName} className="object-cover" /> : null}
            <AvatarFallback className="rounded-full text-xl">{initials(fullName)}</AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold text-foreground">{fullName}</h1>
              <Badge variant="default">{roleLabel}</Badge>
              {badges}
            </div>
            {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {tenureLine && <span>{tenureLine}</span>}
              <span className="flex items-center gap-1.5">
                <span
                  className={cn("size-4 rounded-full", isActive ? "bg-success" : "bg-muted-foreground/50")}
                  aria-hidden="true"
                />
                <span className={isActive ? "text-success" : undefined}>{isActive ? "Active" : "Inactive"}</span>
              </span>
            </div>
          </div>
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children && <div className="border-t border-border px-5">{children}</div>}
    </Card>
  );
}

/** Underline tabs, as in the design — distinct from the pill `DetailTabs` the
 * admin record pages use, which read as a filter rather than a section switch. */
export function ProfileTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div role="tablist" className="scrollbar-slim -mb-px flex gap-6 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={cn(
              "shrink-0 cursor-pointer border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Titled card holding a two-column field grid — the repeating unit of the
 * profile body ("Personal information", "Emergency contact", …). */
export function ProfileInfoCard({
  title,
  icon: Icon,
  description,
  fields,
  action,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  description?: string;
  fields?: ProfileFieldSpec[];
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="size-10 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </div>

      <div className="flex flex-col gap-5 p-5">
        {fields && fields.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium break-words text-foreground">{field.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </Card>
  );
}

/** The profile body's two-column frame. Cards are grouped per column rather than
 * flowed through one grid, so a tall card on the left cannot push its right-hand
 * neighbour down the page. */
export function ProfileColumns({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">{left}</div>
      <div className="flex flex-col gap-4">{right}</div>
    </div>
  );
}

/** Row used by the linked-people lists (a student's guardians, a guardian's
 * children) — a name with its relation, and one trailing identifier. */
export function ProfileLinkedRow({
  name,
  meta,
  trailing,
  isPrimary,
}: {
  name: string;
  meta?: string | null;
  trailing?: React.ReactNode;
  isPrimary?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded border border-border px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-18 rounded-full">
          <AvatarFallback className="rounded-full">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
            {name}
            {isPrimary && <Badge variant="info">Primary</Badge>}
          </span>
          {meta && <span className="truncate text-xs text-muted-foreground capitalize">{meta}</span>}
        </div>
      </div>
      {trailing && <span className="shrink-0 text-sm text-muted-foreground">{trailing}</span>}
    </div>
  );
}

/** Link to an uploaded document, or an em dash when there is nothing on file. */
export function DocumentLink({ url, label }: { url: string | null | undefined; label: string }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
      {label}
    </a>
  );
}
