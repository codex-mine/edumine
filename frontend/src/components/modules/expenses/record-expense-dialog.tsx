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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useCreateExpenseMutation, useExpenseCategoriesQuery } from "@/hooks/use-expenses";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordExpenseDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useExpenseCategoriesQuery();
  const createMutation = useCreateExpenseMutation();
  const categories = categoriesQuery.data ?? [];

  function resetForm() {
    setCategoryId("");
    setAmount("");
    setDescription("");
    setExpenseDate(today());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!categoryId) {
      setError("Select an expense category");
      return;
    }
    try {
      await createMutation.mutateAsync({
        category_id: categoryId,
        amount: Number(amount),
        description: description || undefined,
        expense_date: expenseDate,
      });
      setOpen(false);
      resetForm();
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>
            Submitted expenses require Admin/Principal approval before they are finalized.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense_category">Category</Label>
            <Select value={categoryId || undefined} onValueChange={setCategoryId}>
              <SelectTrigger id="expense_category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense_amount">Amount</Label>
            <Input
              id="expense_amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense_date">Expense date</Label>
            <Input
              id="expense_date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense_description">Item details (optional)</Label>
            <Textarea
              id="expense_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Itemize what this expense covers"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Submit for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
