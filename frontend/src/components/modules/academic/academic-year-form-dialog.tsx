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
import { useAcademicYearsQuery, useCreateAcademicYearMutation } from "@/hooks/use-academic";

export function AcademicYearFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cloneFromYearId, setCloneFromYearId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const yearsQuery = useAcademicYearsQuery();
  const createMutation = useCreateAcademicYearMutation();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        name,
        start_date: startDate,
        end_date: endDate,
        clone_from_year_id: cloneFromYearId || null,
      });
      setName("");
      setStartDate("");
      setEndDate("");
      setCloneFromYearId("");
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
          <DialogTitle>Create academic year</DialogTitle>
          <DialogDescription>
            Optionally carry forward classes, sections, subject-teacher assignments, and routines from a prior year.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ay_name">Name</Label>
            <Input
              id="ay_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2026-2027"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ay_start">Start date</Label>
              <Input id="ay_start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ay_end">End date</Label>
              <Input id="ay_end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ay_clone">Carry forward from (optional)</Label>
            <Select value={cloneFromYearId || undefined} onValueChange={(value) => setCloneFromYearId(value)}>
              <SelectTrigger id="ay_clone">
                <SelectValue placeholder="Start fresh (no carry-forward)" />
              </SelectTrigger>
              <SelectContent>
                {(yearsQuery.data ?? []).map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Create academic year
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
