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
import { useCreateExpenseCategoryMutation, useUpdateExpenseCategoryMutation } from "@/hooks/use-expenses";
import type { ExpenseCategory } from "@/lib/api/expenses";

export function ExpenseCategoryFormDialog({
  trigger,
  category,
}: {
  trigger: React.ReactNode;
  category?: ExpenseCategory;
}) {
  const isEdit = Boolean(category);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateExpenseCategoryMutation();
  const updateMutation = useUpdateExpenseCategoryMutation();
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
          <DialogTitle>{isEdit ? "Edit expense category" : "Add expense category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this expense category."
              : "Expense categories group institutional spending, e.g. utilities, maintenance, supplies, or transport."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense_category_name">Name</Label>
            <Input
              id="expense_category_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Utilities"
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
