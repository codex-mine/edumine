"use client";

import { Eye, MoreHorizontal, Pencil, Trash2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActionsMenu({
  onView,
  onEdit,
  onSoftDelete,
  onHardDelete,
  softDeleteLabel = "Delete",
  softDeleteDescription = "This record will be soft-deleted and hidden from active views. It can be recovered by an administrator if needed.",
  hardDeleteDescription = "This permanently removes the record and all identity data. This action cannot be undone.",
  isDeleting,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onSoftDelete?: () => void;
  onHardDelete?: () => void;
  softDeleteLabel?: string;
  softDeleteDescription?: string;
  hardDeleteDescription?: string;
  isDeleting?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label="Row actions">
          <MoreHorizontal className="size-6" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        {onView && (
          <DropdownMenuItem onSelect={onView}>
            <Eye className="!size-8" aria-hidden="true" />
            View
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        )}
        {onSoftDelete && (
          <>
            <DropdownMenuSeparator />
            <ConfirmDialog
              trigger={
                <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                  <Trash2 className="!size-8" aria-hidden="true" />
                  {softDeleteLabel}
                </DropdownMenuItem>
              }
              title="Delete this record?"
              description={softDeleteDescription}
              confirmLabel="Delete"
              onConfirm={onSoftDelete}
              isPending={isDeleting}
            />
          </>
        )}
        {onHardDelete && (
          <ConfirmDialog
            trigger={
              <DropdownMenuItem variant="destructive"  onSelect={(event) => event.preventDefault()}>
                <ShieldAlert className="!size-8" aria-hidden="true" />
                Permanently delete
              </DropdownMenuItem>
            }
            title="Permanently delete this record?"
            description={hardDeleteDescription}
            confirmLabel="Permanently delete"
            onConfirm={onHardDelete}
            isPending={isDeleting}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
