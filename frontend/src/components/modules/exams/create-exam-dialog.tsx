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
import { useClassesQuery } from "@/hooks/use-academic";
import { useCreateExamMutation } from "@/hooks/use-exams";

export function CreateExamDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const classesQuery = useClassesQuery();
  const createMutation = useCreateExamMutation();

  function toggleClass(classId: string) {
    setClassIds((prev) => (prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]));
  }

  function resetForm() {
    setName("");
    setTerm("");
    setStartDate("");
    setEndDate("");
    setClassIds([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        name,
        term: term || null,
        start_date: startDate,
        end_date: endDate,
        class_ids: classIds,
      });
      resetForm();
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
          <DialogTitle>Create exam</DialogTitle>
          <DialogDescription>
            Select the classes participating in this exam. You&apos;ll configure subjects, teachers, and deadlines
            next.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam_name">Exam name</Label>
            <Input
              id="exam_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mid-Term Examination"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam_term">Term (optional)</Label>
            <Input id="exam_term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Term 1" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="exam_start">Start date</Label>
              <Input id="exam_start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="exam_end">End date</Label>
              <Input id="exam_end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Participating classes</Label>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded border border-border p-2">
              {(classesQuery.data ?? []).map((cls) => (
                <label key={cls.id} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckboxUi checked={classIds.includes(cls.id)} onCheckedChange={() => toggleClass(cls.id)} />
                  {cls.name}
                </label>
              ))}
              {classesQuery.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">No classes found — create one first.</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || classIds.length === 0}>
              Create exam
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
