"use client";

import { Badge } from "@/components/ui/badge";
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
import { useStudentReportCardQuery } from "@/hooks/use-results";

export function StudentResultsPanel({
  studentId,
  academicYearId,
  yearLabel,
}: {
  studentId: string;
  academicYearId?: string;
  yearLabel?: string;
}) {
  const query = useStudentReportCardQuery(studentId, academicYearId);
  const report = query.data;

  if (query.isPending) return <LoadingState label="Loading results..." />;
  if (query.isError) {
    return <ErrorState message={loginErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  if (!report || report.exams.length === 0) {
    return (
      <DetailSection title="Results" description={yearLabel ? `Published results for ${yearLabel}.` : undefined}>
        <EmptyState message="No published results for this academic year." />
      </DetailSection>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile
          label="Overall"
          value={`${report.overall_percentage.toFixed(1)}%`}
          hint={yearLabel}
          tone={report.overall_percentage >= 60 ? "positive" : report.overall_percentage >= 40 ? "warning" : "negative"}
        />
        <StatTile label="Grade" value={report.overall_grade ?? "—"} />
        <StatTile
          label="Marks"
          value={`${report.overall_total_obtained}/${report.overall_total_full_marks}`}
        />
        <StatTile label="Exams" value={report.exams.length} hint="published" />
      </StatGrid>

      {report.exams.map((exam) => (
        <DetailSection
          key={exam.exam_id}
          title={exam.exam_name}
          description={[exam.term, `${exam.total_obtained}/${exam.total_full_marks} · ${exam.percentage.toFixed(1)}%`]
            .filter(Boolean)
            .join(" · ")}
        >
          <SimpleTable
            headers={["Subject", "Marks", "Full", "Grade", "Result"]}
            rows={exam.subjects.map((subject) => [
              subject.subject_name,
              subject.is_absent ? "Absent" : (subject.marks_obtained ?? "—"),
              subject.full_marks,
              subject.grade ?? "—",
              <Badge key={subject.subject_name} variant={subject.passed ? "success" : "destructive"}>
                {subject.passed ? "Passed" : "Failed"}
              </Badge>,
            ])}
          />
        </DetailSection>
      ))}
    </div>
  );
}
