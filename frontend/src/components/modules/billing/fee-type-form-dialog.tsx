"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckboxUi } from "@/components/ui/checkbox";
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
import { useCreateFeeTypeMutation, useUpdateFeeTypeMutation } from "@/hooks/use-billing";
import type { FeeType } from "@/lib/api/billing";

export function FeeTypeFormDialog({ trigger, feeType }: { trigger: React.ReactNode; feeType?: FeeType }) {
  const isEdit = Boolean(feeType);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(feeType?.name ?? "");
  const [isRecurring, setIsRecurring] = useState(feeType?.is_recurring ?? false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateFeeTypeMutation();
  const updateMutation = useUpdateFeeTypeMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && feeType) {
        await updateMutation.mutateAsync({ feeTypeId: feeType.id, payload: { name, is_recurring: isRecurring } });
      } else {
        await createMutation.mutateAsync({ name, is_recurring: isRecurring });
        setName("");
        setIsRecurring(false);
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
          <DialogTitle>{isEdit ? "Edit fee type" : "Add fee type"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this fee type."
              : "Fee types are reusable master records, e.g. admission, session, monthly tuition, sports, or custom fees."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fee_type_name">Name</Label>
            <Input
              id="fee_type_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Tuition"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <CheckboxUi checked={isRecurring} onCheckedChange={(checked) => setIsRecurring(checked === true)} />
            Recurring fee (e.g. billed monthly)
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Save changes" : "Add fee type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
