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
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAddDiscountMutation } from "@/hooks/use-billing";
import type { DiscountType, InvoiceDetail } from "@/lib/api/billing";

export function AddDiscountDialog({ trigger, invoice }: { trigger: React.ReactNode; invoice: InvoiceDetail }) {
  const [open, setOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("flat");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addMutation = useAddDiscountMutation();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addMutation.mutateAsync({
        invoiceId: invoice.id,
        payload: { discount_type: discountType, value: Number(value), reason: reason || undefined },
      });
      setOpen(false);
      setValue("");
      setReason("");
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add discount</DialogTitle>
          <DialogDescription>Applies to invoice {invoice.invoice_number}.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discount_type">Type</Label>
            <Select value={discountType} onValueChange={(value) => setDiscountType(value as DiscountType)}>
              <SelectTrigger id="discount_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat amount</SelectItem>
                <SelectItem value="percentage">Percentage of subtotal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discount_value">{discountType === "flat" ? "Amount" : "Percentage"}</Label>
            <Input
              id="discount_value"
              type="number"
              min={0.01}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discount_reason">Reason (optional)</Label>
            <Input id="discount_reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. sibling discount" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={addMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              Apply discount
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
