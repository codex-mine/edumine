"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ActiveBadge, StatusBadge } from "@/components/modules/people/status-badge";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useTeacherQuery } from "@/hooks/use-teachers";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function TeacherDetailDialog({
  teacherId,
  open,
  onOpenChange,
}: {
  teacherId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const teacherQuery = useTeacherQuery(open ? teacherId : null);
  const teacher = teacherQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teacher details</DialogTitle>
          <DialogDescription>Complete profile, documents, and qualifications.</DialogDescription>
        </DialogHeader>

        {teacherQuery.isLoading ? (
          <LoadingState label="Loading teacher..." />
        ) : teacherQuery.isError ? (
          <ErrorState message={loginErrorMessage(teacherQuery.error)} onRetry={() => teacherQuery.refetch()} />
        ) : teacher ? (
          <div className="flex flex-col gap-4 text-sm">
            <div className="rounded border border-border p-3">
              <DetailRow label="Full name" value={teacher.full_name} />
              <DetailRow label="Employee #" value={teacher.employee_code} />
              <DetailRow label="Designation" value={teacher.designation} />
              <DetailRow label="Status" value={<StatusBadge status={teacher.status} />} />
              <DetailRow label="Account" value={<ActiveBadge isActive={teacher.is_active} />} />
              <DetailRow label="Email" value={teacher.email} />
              <DetailRow label="Phone" value={teacher.phone} />
              <DetailRow label="Gender" value={teacher.gender} />
              <DetailRow label="Date of birth" value={teacher.date_of_birth} />
              <DetailRow label="Joining date" value={teacher.joining_date} />
              <DetailRow label="NID number" value={teacher.nid_number} />
              <DetailRow
                label="NID document"
                value={
                  teacher.nid_document_url ? (
                    <a href={teacher.nid_document_url} target="_blank" rel="noreferrer" className="text-primary underline">
                      View
                    </a>
                  ) : null
                }
              />
              <DetailRow label="Qualification summary" value={teacher.qualification} />
              <DetailRow label="Previous employment" value={teacher.previous_employment} />
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-medium text-foreground">Qualifications</p>
              {teacher.qualifications.length === 0 ? (
                <p className="text-xs text-muted-foreground">No qualifications on record.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {teacher.qualifications.map((q) => (
                    <div key={q.id} className="rounded border border-border p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{q.education_title}</span>
                        <span className="text-xs text-muted-foreground">{q.passing_year ?? "—"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {q.institute}
                        {q.grade ? ` · ${q.grade}` : ""}
                      </p>
                      {q.additional_info && <p className="pt-1 text-xs text-muted-foreground">{q.additional_info}</p>}
                      <div className="flex gap-3 pt-1 text-xs">
                        {q.certificate_url && (
                          <a href={q.certificate_url} target="_blank" rel="noreferrer" className="text-primary underline">
                            Certificate
                          </a>
                        )}
                        {q.marksheet_url && (
                          <a href={q.marksheet_url} target="_blank" rel="noreferrer" className="text-primary underline">
                            Marksheet
                          </a>
                        )}
                      </div>
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
