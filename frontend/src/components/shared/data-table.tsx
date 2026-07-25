"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { cn } from "@/lib/utils";

export interface DataTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export interface DataTableProps {
  title: string;
  description?: string;
  columns: DataTableColumn[];
  rows: Array<Record<string, React.ReactNode>>;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyMessage?: string;
  toolbarActions?: React.ReactNode;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function DataTable({
  title,
  description,
  columns,
  rows,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyMessage = "No records found.",
  toolbarActions,
  searchValue,
  onSearchChange,
    searchPlaceholder = "Search...",
  page,
  limit,
  total,
  onPageChange,
}: DataTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card >
      <CardHeader className="p-4">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {toolbarActions && <CardAction>{toolbarActions}</CardAction>}
      </CardHeader>

      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-6 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState label={`Loading ${title.toLowerCase()}...`} />
      ) : isError ? (
        <div className="px-4 pb-1">
          <ErrorState message={errorMessage} onRetry={onRetry} />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 pb-1">
          <EmptyState message={emptyMessage} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left ">
              <thead className="bg-muted">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        "px-4 py-4   font-medium text-muted-foreground",
                        column.align === "right" && "text-right"
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => (
                  <tr key={index} className="hover:bg-muted/50">
                    {columns.map((column) => (
                      <td key={column.key} className={cn("px-4 py-2.5", column.align === "right" && "text-right")}>
                        {row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 pt-1  text-muted-foreground">
            <span>
              Page {page} of {totalPages} &middot; {total} total
            </span>
            <div className="flex gap-2">
              <Button    disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Previous
              </Button>
              <Button
                 
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
