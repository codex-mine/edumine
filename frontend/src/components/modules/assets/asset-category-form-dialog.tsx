"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useCreateAssetCategoryMutation, useUpdateAssetCategoryMutation } from "@/hooks/use-assets";
import type { AssetCategory } from "@/lib/api/assets";

export function AssetCategoryFormDialog({
  trigger,
  category,
}: {
  trigger: React.ReactNode;
  category?: AssetCategory;
}) {
  const isEdit = Boolean(category);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateAssetCategoryMutation();
  const updateMutation = useUpdateAssetCategoryMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && category) {
        await updateMutation.mutateAsync({ categoryId: category.id, payload: { name } });
      } else {
        await createMutation.mutateAsync({ name });
        setName("");
      }
      setOpen(false);
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit asset category" : "Add asset category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this asset category."
              : "Asset categories group institutional inventory, e.g. furniture, electronics, or networking equipment."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset_category_name">Name</Label>
            <Input
              id="asset_category_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Electronics"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
