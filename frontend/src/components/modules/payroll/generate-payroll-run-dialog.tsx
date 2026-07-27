"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useGeneratePayrollRunMutation } from "@/hooks/use-payroll";
import { MONTH_LABELS, type PayrollRunDetail } from "@/lib/api/payroll";

const now = new Date();
const YEAR_OPTIONS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

export function GeneratePayrollRunDialog({
  trigger,
  runBasePath,
}: {
  trigger: React.ReactNode;
  runBasePath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PayrollRunDetail | null>(null);

  const generateMutation = useGeneratePayrollRunMutation();

  function resetForm() {
    setMonth(String(now.getMonth() + 1));
    setYear(String(now.getFullYear()));
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const data = await generateMutation.mutateAsync({ period_month: Number(month), period_year: Number(year) });
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
        if (next) resetForm();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate payroll run</DialogTitle>
          <DialogDescription>
            Generates a payslip for every active teacher and staff member with a salary structure effective for the
            selected period.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-success">
              <CircleCheck className="size-4" aria-hidden="true" />
              Generated {result.payslip_count} payslip{result.payslip_count === 1 ? "" : "s"} for{" "}
              {MONTH_LABELS[result.period_month - 1]} {result.period_year}.
            </div>
            {result.skipped && result.skipped.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded border border-border p-3">
                <span className="text-sm font-medium text-foreground">
                  Skipped ({result.skipped.length}) — no salary structure effective for this period
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.skipped.map((employee) => (
                    <Badge key={`${employee.employee_type}-${employee.teacher_id ?? employee.staff_id}`} variant="warning">
                      {employee.full_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`${runBasePath}/${result.id}`);
                }}
              >
                View payroll run
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="run_month">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger id="run_month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_LABELS.map((label, index) => (
                      <SelectItem key={label} value={String(index + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="run_year">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger id="run_year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={generateMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={generateMutation.isPending}>
                Generate
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
