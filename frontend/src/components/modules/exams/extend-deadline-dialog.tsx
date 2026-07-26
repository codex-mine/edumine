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
import { useExtendDeadlineMutation } from "@/hooks/use-exams";

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ExtendDeadlineDialog({
  trigger,
  examSubjectId,
  currentDeadline,
  subjectLabel,
}: {
  trigger: React.ReactNode;
  examSubjectId: string;
  currentDeadline: string;
  subjectLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [newDeadline, setNewDeadline] = useState(toLocalInputValue(currentDeadline));
  const [error, setError] = useState<string | null>(null);

  const extendMutation = useExtendDeadlineMutation();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await extendMutation.mutateAsync({
        examSubjectId,
        newDeadline: new Date(newDeadline).toISOString(),
      });
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
          <DialogTitle>Extend question deadline</DialogTitle>
          <DialogDescription>{subjectLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_deadline">New deadline</Label>
            <Input
              id="new_deadline"
              type="datetime-local"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={extendMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={extendMutation.isPending}>
              Extend deadline
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
