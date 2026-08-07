"use client";

import Link from "next/link";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
  title: string;
  /** Rendered top-right — usually this section's own <PeriodFilter />. */
  action?: React.ReactNode;
  /** "View All" style link, shown instead of (or beside) the action. */
  link?: { label: string; href: string };
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/** The shared shell every overview card sits in: title row, optional per-section
 * filter, then the body. Keeps padding and header rhythm identical across cards. */
export function SectionCard({ title, action, link, className, contentClassName, children }: SectionCardProps) {
  return (
    <Card className={cn("gap-6 [--card-spacing:--spacing(10)]", className)}>
      <CardHeader className="items-center">
        <CardTitle className="text-base">{title}</CardTitle>
        {(action || link) && (
          <CardAction className="flex items-center gap-4">
            {link && (
              <Link
                href={link.href}
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                {link.label}
              </Link>
            )}
            {action}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export interface SectionStateProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  /** Matches the height of the loaded content so the card doesn't jump. */
  skeletonHeight?: string;
  children: React.ReactNode;
}

/** Per-card loading/error/empty handling — each section loads on its own, so a
 * slow one never blanks the rest of the dashboard. */
export function SectionState({
  isLoading,
  isError,
  isEmpty = false,
  emptyMessage = "Nothing to show for this period.",
  errorMessage = "Couldn't load this section.",
  skeletonHeight = "h-56",
  children,
}: SectionStateProps) {
  if (isLoading) return <Skeleton className={cn("w-full rounded", skeletonHeight)} />;
  if (isError) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-destructive", skeletonHeight)}>
        {errorMessage}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className={cn("flex items-center justify-center", skeletonHeight)}>
        <EmptyState message={emptyMessage} />
      </div>
    );
  }
  return <>{children}</>;
}
