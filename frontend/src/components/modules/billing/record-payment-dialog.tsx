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
import { useRecordPaymentMutation } from "@/hooks/use-billing";
import { PAYMENT_METHODS, type InvoiceDetail, type PaymentMethod } from "@/lib/api/billing";

export function RecordPaymentDialog({
  trigger,
  invoice,
  onRecorded,
}: {
  trigger: React.ReactNode;
  invoice: InvoiceDetail;
  onRecorded?: (paymentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(invoice.due_amount));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recordMutation = useRecordPaymentMutation();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await recordMutation.mutateAsync({
        invoiceId: invoice.id,
        payload: {
          amount: Number(amount),
          method,
          transaction_reference: reference || undefined,
        },
      });
      setOpen(false);
      setReference("");
      onRecorded?.(result.payment_id);
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setAmount(String(invoice.due_amount));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Invoice {invoice.invoice_number} — outstanding due amount: {invoice.due_amount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay_amount">Amount</Label>
            <Input
              id="pay_amount"
              type="number"
              min={0.01}
              max={invoice.due_amount}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay_method">Method</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <SelectTrigger id="pay_method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay_reference">Transaction reference (optional)</Label>
            <Input
              id="pay_reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Gateway or cheque reference"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={recordMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordMutation.isPending}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
