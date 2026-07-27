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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useClassesQuery } from "@/hooks/use-academic";
import { useFeeTypesQuery, useGenerateInvoicesForClassMutation } from "@/hooks/use-billing";
import type { GenerateInvoicesForClassResult } from "@/lib/api/billing";

export function GenerateClassInvoicesDialog({
  trigger,
  academicYearId,
}: {
  trigger: React.ReactNode;
  academicYearId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [feeTypeIds, setFeeTypeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateInvoicesForClassResult | null>(null);

  const classesQuery = useClassesQuery();
  const feeTypesQuery = useFeeTypesQuery();
  const generateMutation = useGenerateInvoicesForClassMutation();

  function toggleFeeType(feeTypeId: string) {
    setFeeTypeIds((prev) => (prev.includes(feeTypeId) ? prev.filter((id) => id !== feeTypeId) : [...prev, feeTypeId]));
  }

  function resetForm() {
    setClassId("");
    setFeeTypeIds([]);
    setDueDate("");
    setResult(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    try {
      const data = await generateMutation.mutateAsync({
        classId,
        payload: { fee_type_ids: feeTypeIds, due_date: dueDate, academic_year_id: academicYearId },
      });
      setResult(data);
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
          resetForm();
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate invoices for a class</DialogTitle>
          <DialogDescription>
            Creates one invoice per actively enrolled student in the class, using the class fee structure.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              Generated <span className="font-medium">{result.created.length}</span> invoice(s) for{" "}
              <span className="font-medium">{result.class_name}</span>.
              {result.skipped_student_ids.length > 0 && (
                <>
                  {" "}
                  Skipped {result.skipped_student_ids.length} student(s) who already had an invoice with this due
                  date.
                </>
              )}
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gci_class">Class</Label>
              <Select value={classId || undefined} onValueChange={setClassId}>
                <SelectTrigger id="gci_class">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {(classesQuery.data ?? []).map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Fee items to include</Label>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-border p-2">
                {(feeTypesQuery.data ?? []).map((feeType) => (
                  <label key={feeType.id} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckboxUi
                      checked={feeTypeIds.includes(feeType.id)}
                      onCheckedChange={() => toggleFeeType(feeType.id)}
                    />
                    {feeType.name}
                  </label>
                ))}
                {feeTypesQuery.data?.length === 0 && <EmptyState message="No fee types defined yet." />}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gci_due_date">Due date</Label>
              <Input id="gci_due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={generateMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={generateMutation.isPending || !classId || feeTypeIds.length === 0 || !dueDate}>
                Generate invoices
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
