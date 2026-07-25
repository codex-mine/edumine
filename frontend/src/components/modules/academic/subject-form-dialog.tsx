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
import { useCreateSubjectMutation, useUpdateSubjectMutation } from "@/hooks/use-academic";
import type { Subject } from "@/lib/api/academic";

export function SubjectFormDialog({ trigger, subject }: { trigger: React.ReactNode; subject?: Subject }) {
  const isEdit = Boolean(subject);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subject?.name ?? "");
  const [code, setCode] = useState(subject?.code ?? "");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateSubjectMutation();
  const updateMutation = useUpdateSubjectMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && subject) {
        await updateMutation.mutateAsync({ subjectId: subject.id, payload: { name, code } });
      } else {
        await createMutation.mutateAsync({ name, code });
        setName("");
        setCode("");
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
          <DialogTitle>{isEdit ? "Edit subject" : "Add subject"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this subject." : "Subjects are reusable master records shared across academic years."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sub_name">Name</Label>
            <Input id="sub_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sub_code">Code</Label>
            <Input id="sub_code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MATH" required />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Save changes" : "Add subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
