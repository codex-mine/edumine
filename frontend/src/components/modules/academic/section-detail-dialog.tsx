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
import { StatusBadge } from "@/components/modules/people/status-badge";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useEnrollmentsQuery } from "@/hooks/use-academic";
import { formatSectionOccupancy, type Section } from "@/lib/api/academic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

/** Split out so the enrolled-students query only runs once a section is actually
 * being viewed — the dialog's content is unmounted while closed. */
function SectionDetailBody({ section }: { section: Section }) {
  const enrollmentsQuery = useEnrollmentsQuery({ section_id: section.id });

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="rounded border border-border p-3">
        <DetailRow label="Class" value={section.class_name} />
        <DetailRow label="Section" value={section.name} />
        <DetailRow label="Room" value={section.room_name} />
        <DetailRow label="Capacity" value={formatSectionOccupancy(section)} />
        <DetailRow label="Class teacher" value={section.class_teacher_name ?? "Unassigned"} />
        <DetailRow label="Created" value={new Date(section.created_at).toLocaleDateString()} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-medium text-foreground">Enrolled students</p>
        {enrollmentsQuery.isPending ? (
          <LoadingState label="Loading enrolled students..." />
        ) : enrollmentsQuery.isError ? (
          <ErrorState
            message={loginErrorMessage(enrollmentsQuery.error)}
            onRetry={() => enrollmentsQuery.refetch()}
          />
        ) : (enrollmentsQuery.data ?? []).length === 0 ? (
          <EmptyState message="No students enrolled in this section yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {(enrollmentsQuery.data ?? []).map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center justify-between rounded border border-border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{enrollment.student_name}</span>
                  <span className="text-xs text-muted-foreground">
                    Roll {enrollment.roll_number} &middot; {enrollment.admission_number}
                  </span>
                </div>
                <StatusBadge status={enrollment.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionDetailDialog({
  section,
  open,
  onOpenChange,
}: {
  section: Section | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Section details</DialogTitle>
          <DialogDescription>Room, capacity, class teacher, and the students enrolled.</DialogDescription>
        </DialogHeader>

        {section ? <SectionDetailBody section={section} /> : null}
      </DialogContent>
    </Dialog>
  );
}
