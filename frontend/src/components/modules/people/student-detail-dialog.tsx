"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ActiveBadge, StatusBadge } from "@/components/modules/people/status-badge";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useStudentQuery } from "@/hooks/use-students";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function StudentDetailDialog({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const studentQuery = useStudentQuery(open ? studentId : null);
  const student = studentQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Student details</DialogTitle>
          <DialogDescription>Complete profile and guardian information.</DialogDescription>
        </DialogHeader>

        {studentQuery.isLoading ? (
          <LoadingState label="Loading student..." />
        ) : studentQuery.isError ? (
          <ErrorState message={loginErrorMessage(studentQuery.error)} onRetry={() => studentQuery.refetch()} />
        ) : student ? (
          <div className="flex flex-col gap-4 text-sm">
            <div className="rounded border border-border p-3">
              <DetailRow label="Full name" value={student.full_name} />
              <DetailRow label="Admission #" value={student.admission_number} />
              <DetailRow
                label="Class / Section"
                value={student.class_name ? `${student.class_name} - ${student.section_name}` : "Not enrolled"}
              />
              <DetailRow label="Roll number" value={student.roll_number} />
              <DetailRow label="Status" value={<StatusBadge status={student.status} />} />
              <DetailRow label="Account" value={<ActiveBadge isActive={student.is_active} />} />
              <DetailRow label="Email" value={student.email} />
              <DetailRow label="Phone" value={student.phone} />
              <DetailRow label="Gender" value={student.gender} />
              <DetailRow label="Date of birth" value={student.date_of_birth} />
              <DetailRow label="Admission date" value={student.admission_date} />
              <DetailRow label="Blood group" value={student.blood_group} />
              <DetailRow label="Emergency contact" value={student.emergency_contact} />
              <DetailRow label="Address" value={student.address} />
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-medium text-foreground">Guardians</p>
              {student.guardians.length === 0 ? (
                <EmptyState message="No guardians linked yet." />
              ) : (
                <div className="flex flex-col gap-2">
                  {student.guardians.map((guardian) => (
                    <div
                      key={guardian.guardian_id}
                      className="flex items-center justify-between rounded border border-border px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{guardian.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {guardian.relation} &middot; {guardian.phone}
                        </span>
                      </div>
                      {guardian.is_primary && <span className="text-xs text-primary">Primary</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
