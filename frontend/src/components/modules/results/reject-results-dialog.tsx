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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useRejectResultsMutation } from "@/hooks/use-results";

export function RejectResultsDialog({
  trigger,
  examId,
  examLabel,
}: {
  trigger: React.ReactNode;
  examId: string;
  examLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rejectMutation = useRejectResultsMutation();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await rejectMutation.mutateAsync({ examId, reason });
      setOpen(false);
      setReason("");
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send results back for revision</DialogTitle>
          <DialogDescription>{examLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject_reason">Reason</Label>
            <Textarea
              id="reject_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What needs to be corrected before resubmission?"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={rejectMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={rejectMutation.isPending}>
              Send back
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
