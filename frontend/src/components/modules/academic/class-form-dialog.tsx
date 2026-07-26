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
import { useCreateClassMutation, useUpdateClassMutation } from "@/hooks/use-academic";
import type { ClassItem } from "@/lib/api/academic";

export function ClassFormDialog({ trigger, classItem }: { trigger: React.ReactNode; classItem?: ClassItem }) {
  const isEdit = Boolean(classItem);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(classItem?.name ?? "");
  const [numericOrder, setNumericOrder] = useState(String(classItem?.numeric_order ?? ""));
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateClassMutation();
  const updateMutation = useUpdateClassMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && classItem) {
        await updateMutation.mutateAsync({
          classId: classItem.id,
          payload: { name, numeric_order: Number(numericOrder) },
        });
      } else {
        await createMutation.mutateAsync({ name, numeric_order: Number(numericOrder) });
        setName("");
        setNumericOrder("");
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
          <DialogTitle>{isEdit ? "Edit class" : "Add class"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this class." : "Classes are reusable master records shared across academic years."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_name">Name</Label>
            <Input id="c_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 6" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_order">Sort / promotion order</Label>
            <Input
              id="c_order"
              type="number"
              min={0}
              value={numericOrder}
              onChange={(e) => setNumericOrder(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Save changes" : "Add class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
