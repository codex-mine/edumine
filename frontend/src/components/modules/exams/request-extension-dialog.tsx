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
import { Textarea } from "@/components/ui/textarea";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useRequestExtensionMutation } from "@/hooks/use-exams";

export function RequestExtensionDialog({
  trigger,
  examSubjectId,
  subjectLabel,
}: {
  trigger: React.ReactNode;
  examSubjectId: string;
  subjectLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [requestedDeadline, setRequestedDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const requestMutation = useRequestExtensionMutation();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await requestMutation.mutateAsync({
        examSubjectId,
        reason,
        requestedDeadline: new Date(requestedDeadline).toISOString(),
      });
      setSent(true);
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
          setSent(false);
          setReason("");
          setRequestedDeadline("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request deadline extension</DialogTitle>
          <DialogDescription>{subjectLabel}</DialogDescription>
        </DialogHeader>

        {sent ? (
          <p className="text-sm text-success">
            Your request has been sent to the admin. You&apos;ll be able to submit once it&apos;s approved.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ext_deadline">Requested new deadline</Label>
              <Input
                id="ext_deadline"
                type="datetime-local"
                value={requestedDeadline}
                onChange={(e) => setRequestedDeadline(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ext_reason">Reason</Label>
              <Textarea
                id="ext_reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need more time?"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={requestMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={requestMutation.isPending}>
                Send request
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
