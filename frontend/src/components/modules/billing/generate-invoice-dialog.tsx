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
import { EmptyState } from "@/components/shared/empty-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useStudentsQuery } from "@/hooks/use-students";
import { useFeeTypesQuery, useGenerateInvoiceForStudentMutation } from "@/hooks/use-billing";

export function GenerateInvoiceDialog({
  trigger,
  academicYearId,
}: {
  trigger: React.ReactNode;
  academicYearId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [feeTypeIds, setFeeTypeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const studentsQuery = useStudentsQuery({ page: 1, limit: 10, search: studentSearch || undefined });
  const feeTypesQuery = useFeeTypesQuery();
  const generateMutation = useGenerateInvoiceForStudentMutation();

  const selectedStudent = (studentsQuery.data?.items ?? []).find((s) => s.id === selectedStudentId);

  function toggleFeeType(feeTypeId: string) {
    setFeeTypeIds((prev) => (prev.includes(feeTypeId) ? prev.filter((id) => id !== feeTypeId) : [...prev, feeTypeId]));
  }

  function resetForm() {
    setStudentSearch("");
    setSelectedStudentId(null);
    setFeeTypeIds([]);
    setDueDate("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selectedStudentId) {
      setError("Select a student first");
      return;
    }
    try {
      await generateMutation.mutateAsync({
        studentId: selectedStudentId,
        payload: { fee_type_ids: feeTypeIds, due_date: dueDate, academic_year_id: academicYearId },
      });
      resetForm();
      setOpen(false);
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate invoice</DialogTitle>
          <DialogDescription>
            Create an invoice for one student using the fee structure of their currently enrolled class.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gi_student_search">Student</Label>
            <Input
              id="gi_student_search"
              placeholder="Search by name, email, or admission number"
              value={selectedStudent ? selectedStudent.full_name : studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setSelectedStudentId(null);
              }}
            />
            {studentSearch && !selectedStudentId && (
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded border border-border p-1">
                {(studentsQuery.data?.items ?? []).length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No matching students.</p>
                ) : (
                  (studentsQuery.data?.items ?? []).map((candidate) => (
                    <button
                      type="button"
                      key={candidate.id}
                      onClick={() => setSelectedStudentId(candidate.id)}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span>{candidate.full_name}</span>
                      <span className="text-xs text-muted-foreground">{candidate.admission_number}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Fee items to include</Label>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-border p-2">
              {(feeTypesQuery.data ?? []).map((feeType) => (
                <label key={feeType.id} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckboxUi checked={feeTypeIds.includes(feeType.id)} onCheckedChange={() => toggleFeeType(feeType.id)} />
                  {feeType.name}
                </label>
              ))}
              {feeTypesQuery.data?.length === 0 && <EmptyState message="No fee types defined yet." />}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gi_due_date">Due date</Label>
            <Input id="gi_due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={generateMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={generateMutation.isPending || !selectedStudentId || feeTypeIds.length === 0 || !dueDate}>
              Generate invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
