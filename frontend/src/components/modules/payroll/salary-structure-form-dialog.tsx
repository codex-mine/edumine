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
import { useCreateSalaryStructureMutation } from "@/hooks/use-payroll";
import type { PayrollEmployee } from "@/lib/api/payroll";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SalaryStructureFormDialog({
  trigger,
  employee,
}: {
  trigger: React.ReactNode;
  employee: PayrollEmployee;
}) {
  const [open, setOpen] = useState(false);
  const [basicSalary, setBasicSalary] = useState(String(employee.current_salary?.basic_salary ?? ""));
  const [allowances, setAllowances] = useState(String(employee.current_salary?.allowances ?? "0"));
  const [deductions, setDeductions] = useState(String(employee.current_salary?.deductions ?? "0"));
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateSalaryStructureMutation();

  function resetToCurrent() {
    setBasicSalary(String(employee.current_salary?.basic_salary ?? ""));
    setAllowances(String(employee.current_salary?.allowances ?? "0"));
    setDeductions(String(employee.current_salary?.deductions ?? "0"));
    setEffectiveFrom(todayIso());
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        teacher_id: employee.employee_type === "teacher" ? employee.teacher_id ?? undefined : undefined,
        staff_id: employee.employee_type === "staff" ? employee.staff_id ?? undefined : undefined,
        basic_salary: Number(basicSalary),
        allowances: Number(allowances),
        deductions: Number(deductions),
        effective_from: effectiveFrom,
      });
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
        if (next) resetToCurrent();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set salary — {employee.full_name}</DialogTitle>
          <DialogDescription>
            {employee.employee_code} &middot; Saving adds a new effective-dated salary structure; prior structures
            are kept as history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ss_basic">Basic salary</Label>
            <Input
              id="ss_basic"
              type="number"
              min={0}
              step="0.01"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ss_allowances">Allowances</Label>
              <Input
                id="ss_allowances"
                type="number"
                min={0}
                step="0.01"
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ss_deductions">Standing deductions</Label>
              <Input
                id="ss_deductions"
                type="number"
                min={0}
                step="0.01"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ss_effective_from">Effective from</Label>
            <Input
              id="ss_effective_from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !basicSalary || !effectiveFrom}>
              Save salary structure
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
