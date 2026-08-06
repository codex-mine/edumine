"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import {
  DetailSection,
  SimpleTable,
  StatGrid,
  StatTile,
} from "@/components/modules/people/detail/detail-shell";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useClassSubjectsQuery } from "@/hooks/use-academic";
import { useRoutineSlotsQuery } from "@/hooks/use-routine";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/api/routine";

/** What a teacher is responsible for in the selected year: the subjects assigned
 * to them and the weekly periods they are scheduled to take. */
export function TeachingPanel({
  teacherId,
  academicYearId,
  yearLabel,
}: {
  teacherId: string;
  academicYearId?: string;
  yearLabel?: string;
}) {
  const classSubjectsQuery = useClassSubjectsQuery({ academic_year_id: academicYearId });
  const routineQuery = useRoutineSlotsQuery({ academic_year_id: academicYearId, teacher_id: teacherId });

  const assignments = (classSubjectsQuery.data ?? []).filter((row) => row.teacher_id === teacherId);
  const slots = routineQuery.data ?? [];
  const sections = new Set(slots.map((slot) => slot.section_id));

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile label="Subjects assigned" value={assignments.length} hint={yearLabel} />
        <StatTile label="Weekly periods" value={slots.length} hint={yearLabel} />
        <StatTile label="Sections taught" value={sections.size} />
        <StatTile
          label="Classes"
          value={new Set(assignments.map((row) => row.class_id)).size}
        />
      </StatGrid>

      <DetailSection
        title="Subject assignments"
        description={yearLabel ? `Class-subject assignments for ${yearLabel}.` : undefined}
      >
        {classSubjectsQuery.isPending ? (
          <LoadingState label="Loading assignments..." />
        ) : classSubjectsQuery.isError ? (
          <ErrorState
            message={loginErrorMessage(classSubjectsQuery.error)}
            onRetry={() => classSubjectsQuery.refetch()}
          />
        ) : assignments.length === 0 ? (
          <EmptyState message="No subjects assigned for this academic year." />
        ) : (
          <SimpleTable
            headers={["Class", "Subject", "Code", "Full marks"]}
            rows={assignments.map((row) => [row.class_name, row.subject_name, row.subject_code, row.full_marks])}
          />
        )}
      </DetailSection>

      <DetailSection
        title="Weekly routine"
        description={yearLabel ? `Scheduled periods for ${yearLabel}.` : undefined}
      >
        {routineQuery.isPending ? (
          <LoadingState label="Loading routine..." />
        ) : routineQuery.isError ? (
          <ErrorState message={loginErrorMessage(routineQuery.error)} onRetry={() => routineQuery.refetch()} />
        ) : slots.length === 0 ? (
          <EmptyState message="No routine periods scheduled for this academic year." />
        ) : (
          <div className="flex flex-col gap-3">
            {WEEKDAYS.map((day) => {
              const daySlots = slots
                .filter((slot) => slot.day_of_week === day)
                .sort((a, b) => a.period_number - b.period_number);
              if (daySlots.length === 0) return null;
              return (
                <div key={day} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">{WEEKDAY_LABELS[day]}</span>
                  <SimpleTable
                    headers={["Period", "Time", "Class / Section", "Subject", "Room"]}
                    rows={daySlots.map((slot) => [
                      slot.period_number,
                      `${slot.start_time} – ${slot.end_time}`,
                      `${slot.class_name} - ${slot.section_name}`,
                      slot.subject_name,
                      slot.room_name ?? "—",
                    ])}
                  />
                </div>
              );
            })}
          </div>
        )}
      </DetailSection>
    </div>
  );
}
