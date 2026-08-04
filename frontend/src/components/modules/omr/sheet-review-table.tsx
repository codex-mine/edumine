"use client";

import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useSheetsQuery } from "@/hooks/use-omr";
import {
  MATCH_STATUS_LABELS,
  SHEET_STATUS_LABELS,
  type MatchStatus,
  type OmrSheet,
  type SheetStatus,
} from "@/lib/api/omr";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "needs_review" | "failed";

const FILTERS: { key: FilterKey; label: string; status?: SheetStatus }[] = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs review", status: "needs_review" },
  { key: "failed", label: "Could not read", status: "failed" },
];

const STATUS_VARIANT: Record<SheetStatus, "default" | "success" | "warning" | "destructive"> = {
  pending: "default",
  processed: "success",
  needs_review: "warning",
  failed: "destructive",
  applied: "success",
};

const MATCH_VARIANT: Record<MatchStatus, "default" | "success" | "warning" | "destructive"> = {
  matched: "success",
  manual: "success",
  unmatched: "warning",
  ambiguous: "warning",
  duplicate: "warning",
  unreadable: "destructive",
};

export function SheetReviewTable({
  batchId,
  onOpenSheet,
}: {
  batchId: string;
  onOpenSheet: (sheetId: string) => void;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const active = FILTERS.find((f) => f.key === filter)!;
  const sheetsQuery = useSheetsQuery(batchId, { status: active.status });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sheet filter">
        {FILTERS.map((option) => {
          const isActive = option.key === filter;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(option.key)}
              className={cn(
                "rounded border px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {sheetsQuery.isLoading ? (
        <LoadingState label="Loading scanned sheets..." />
      ) : sheetsQuery.isError ? (
        <ErrorState
          message={loginErrorMessage(sheetsQuery.error)}
          onRetry={() => sheetsQuery.refetch()}
        />
      ) : (sheetsQuery.data ?? []).length === 0 ? (
        <EmptyState
          message={
            filter === "all"
              ? "No sheets uploaded to this batch yet."
              : "Nothing in this category — everything here is resolved."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[54rem] border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Sheet</th>
                <th className="px-3 py-2 font-medium">Detected</th>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sheetsQuery.data!.map((sheet) => (
                <SheetRow key={sheet.id} sheet={sheet} onOpen={() => onOpenSheet(sheet.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SheetRow({ sheet, onOpen }: { sheet: OmrSheet; onOpen: () => void }) {
  const thumbnail = sheet.annotated_image_url ?? sheet.image_url;

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Plain <img>: these are remote Cloudinary URLs whose host is not in
              next.config's image allow-list, and a thumbnail needs no optimisation. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt=""
            width={36}
            height={48}
            loading="lazy"
            className="h-12 w-9 shrink-0 rounded border border-border object-cover"
          />
          <span className="max-w-[10rem] truncate text-foreground" title={sheet.original_filename}>
            {sheet.original_filename}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        <div className="flex flex-col">
          <span>Roll {sheet.detected_roll ?? "—"}</span>
          <span className="text-xs">
            Class {sheet.detected_class ?? "—"} · Set {sheet.detected_set_code ?? "—"}
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        {sheet.student_name ? (
          <span className="text-foreground">{sheet.student_name}</span>
        ) : (
          <span className="text-muted-foreground">Not matched</span>
        )}
      </td>
      <td className="px-3 py-2 text-foreground">
        {sheet.marks_obtained !== null ? (
          <div className="flex flex-col">
            <span>{sheet.marks_obtained}</span>
            <span className="text-xs text-muted-foreground">
              {sheet.correct_count}✓ {sheet.wrong_count}✗ {sheet.blank_count}○
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col items-start gap-1">
          <Badge variant={STATUS_VARIANT[sheet.status]}>{SHEET_STATUS_LABELS[sheet.status]}</Badge>
          {sheet.match_status && sheet.match_status !== "matched" && (
            <Badge variant={MATCH_VARIANT[sheet.match_status]}>
              {MATCH_STATUS_LABELS[sheet.match_status]}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <Button variant="outline" size="sm" onClick={onOpen}>
          Review
        </Button>
      </td>
    </tr>
  );
}
