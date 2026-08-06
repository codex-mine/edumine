"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/modules/people/status-badge";
import type { Enrollment } from "@/lib/api/academic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function EnrollmentDetailDialog({
  enrollment,
  open,
  onOpenChange,
}: {
  enrollment: Enrollment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enrollment details</DialogTitle>
          <DialogDescription>The student&apos;s placement for this academic year.</DialogDescription>
        </DialogHeader>

        {enrollment ? (
          <div className="flex flex-col gap-4 text-sm">
            <div className="rounded border border-border p-3">
              <DetailRow label="Student" value={enrollment.student_name} />
              <DetailRow label="Admission #" value={enrollment.admission_number} />
              <DetailRow label="Roll number" value={enrollment.roll_number} />
              <DetailRow label="Academic year" value={enrollment.academic_year_name} />
              <DetailRow label="Class" value={enrollment.class_name} />
              <DetailRow label="Section" value={enrollment.section_name} />
              <DetailRow label="Status" value={<StatusBadge status={enrollment.status} />} />
              <DetailRow label="Enrolled on" value={new Date(enrollment.created_at).toLocaleDateString()} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
