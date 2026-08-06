"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { AcademicYearSelect } from "@/components/modules/academic/academic-year-select";
import { ActiveBadge, StatusBadge } from "@/components/modules/people/status-badge";
import { ActivityPanel } from "@/components/modules/people/detail/activity-panel";
import { AttendancePanel } from "@/components/modules/people/detail/attendance-panel";
import {
  DetailPageHeader,
  DetailRow,
  DetailSection,
  DetailTabs,
  StatGrid,
  StatTile,
} from "@/components/modules/people/detail/detail-shell";
import { StudentBillingPanel } from "@/components/modules/people/detail/student-billing-panel";
import { StudentResultsPanel } from "@/components/modules/people/detail/student-results-panel";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAcademicYearsQuery, useActiveAcademicYearQuery } from "@/hooks/use-academic";
import { useDailyAttendanceQuery } from "@/hooks/use-attendance";
import { useStudentDuesQuery } from "@/hooks/use-billing";
import { useStudentReportCardQuery } from "@/hooks/use-results";
import { useStudentQuery } from "@/hooks/use-students";
import type { StudentDetail } from "@/lib/api/students";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "personal", label: "Personal" },
  { value: "results", label: "Results" },
  { value: "invoices", label: "Invoices" },
  { value: "attendance", label: "Attendance" },
  { value: "activity", label: "Activity" },
] as const;

type StudentTab = (typeof TABS)[number]["value"];

const currency = (amount: number) => `৳${amount.toLocaleString()}`;

/** Its own component so the three summary queries only run while the Overview
 * tab is on screen, rather than on every tab of the page. */
function StudentOverview({
  student,
  academicYearId,
  yearLabel,
  dateFrom,
  dateTo,
}: {
  student: StudentDetail;
  academicYearId?: string;
  yearLabel?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const reportQuery = useStudentReportCardQuery(student.id, academicYearId);
  const duesQuery = useStudentDuesQuery(student.id);
  const attendanceQuery = useDailyAttendanceQuery({
    user_id: student.user_id,
    date_from: dateFrom,
    date_to: dateTo,
  });

  const records = attendanceQuery.data ?? [];
  const presentish = records.filter((record) => record.status !== "absent").length;
  const rate = records.length > 0 ? Math.round((presentish / records.length) * 100) : null;
  const dues = duesQuery.data?.total_due ?? 0;
  const percentage = reportQuery.data?.overall_percentage ?? null;

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile
          label="Overall result"
          value={percentage === null ? "—" : `${percentage.toFixed(1)}%`}
          hint={reportQuery.data?.overall_grade ? `Grade ${reportQuery.data.overall_grade}` : yearLabel}
          tone={percentage === null ? "default" : percentage >= 60 ? "positive" : percentage >= 40 ? "warning" : "negative"}
        />
        <StatTile
          label="Attendance"
          value={rate === null ? "—" : `${rate}%`}
          hint={yearLabel}
          tone={rate === null ? "default" : rate >= 90 ? "positive" : rate >= 75 ? "warning" : "negative"}
        />
        <StatTile
          label="Outstanding dues"
          value={currency(dues)}
          hint="all years"
          tone={dues > 0 ? "negative" : "positive"}
        />
        <StatTile label="Exams sat" value={reportQuery.data?.exams.length ?? 0} hint={yearLabel} />
      </StatGrid>

      <DetailSection title="At a glance" description="Enrollment and account status.">
        <div className="text-sm">
          <DetailRow label="Admission #" value={student.admission_number} />
          <DetailRow
            label="Class / Section"
            value={student.class_name ? `${student.class_name} - ${student.section_name}` : "Not enrolled"}
          />
          <DetailRow label="Roll number" value={student.roll_number} />
          <DetailRow label="Enrollment status" value={<StatusBadge status={student.status} />} />
          <DetailRow label="Account" value={<ActiveBadge isActive={student.is_active} />} />
          <DetailRow label="Primary guardian" value={student.guardians.find((g) => g.is_primary)?.full_name} />
        </div>
      </DetailSection>

      <ActivityPanel
        subjectId={student.user_id}
        profileId={student.id}
        dateFrom={dateFrom}
        dateTo={dateTo}
        description="Recent changes involving this student."
      />
    </div>
  );
}

function StudentPersonal({ student }: { student: StudentDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <DetailSection title="Personal information" description="Identity and contact details on record.">
        <div className="text-sm">
          <DetailRow label="Full name" value={student.full_name} />
          <DetailRow label="Email" value={student.email} />
          <DetailRow label="Phone" value={student.phone} />
          <DetailRow label="Gender" value={student.gender} />
          <DetailRow label="Date of birth" value={student.date_of_birth} />
          <DetailRow label="Blood group" value={student.blood_group} />
          <DetailRow label="Emergency contact" value={student.emergency_contact} />
          <DetailRow label="Address" value={student.address} />
          <DetailRow label="Admission date" value={student.admission_date} />
        </div>
      </DetailSection>

      <DetailSection title="Guardians" description="People linked to this student.">
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
                  <span className="text-sm font-medium text-foreground">{guardian.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {guardian.relation} &middot; {guardian.phone}
                  </span>
                </div>
                {guardian.is_primary && <Badge variant="default">Primary</Badge>}
              </div>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}

export default function AdminStudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const [tab, setTab] = useState<StudentTab>("overview");
  const [selectedYearOverride, setSelectedYearOverride] = useState("");

  const studentQuery = useStudentQuery(studentId);
  const activeYearQuery = useActiveAcademicYearQuery();
  const yearsQuery = useAcademicYearsQuery();

  const selectedYearId = selectedYearOverride || activeYearQuery.data?.id || "";
  const selectedYear = (yearsQuery.data ?? []).find((year) => year.id === selectedYearId);
  const yearLabel = selectedYear?.name;

  const student = studentQuery.data;

  if (studentQuery.isPending) return <LoadingState label="Loading student..." />;
  if (studentQuery.isError) {
    return (
      <ErrorState message={loginErrorMessage(studentQuery.error)} onRetry={() => studentQuery.refetch()} />
    );
  }
  if (!student) return <EmptyState message="Student not found." />;

  const sharedProps = {
    academicYearId: selectedYearId || undefined,
    yearLabel,
    dateFrom: selectedYear?.start_date,
    dateTo: selectedYear?.end_date,
  };

  return (
    <div className="flex w-full flex-col gap-5">
      <DetailPageHeader
        backHref="/admin/students"
        backLabel="Students"
        title={student.full_name}
        subtitle={`${student.admission_number} · ${
          student.class_name ? `${student.class_name} - ${student.section_name}` : "Not enrolled"
        }`}
        meta={
          <>
            <StatusBadge status={student.status} />
            <ActiveBadge isActive={student.is_active} />
          </>
        }
        actions={<AcademicYearSelect value={selectedYearId} onChange={setSelectedYearOverride} />}
      />

      <DetailTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && <StudentOverview student={student} {...sharedProps} />}
      {tab === "personal" && <StudentPersonal student={student} />}
      {tab === "results" && (
        <StudentResultsPanel
          studentId={student.id}
          academicYearId={sharedProps.academicYearId}
          yearLabel={yearLabel}
        />
      )}
      {tab === "invoices" && (
        <StudentBillingPanel
          studentId={student.id}
          academicYearId={sharedProps.academicYearId}
          yearLabel={yearLabel}
        />
      )}
      {tab === "attendance" && (
        <AttendancePanel
          userId={student.user_id}
          dateFrom={sharedProps.dateFrom}
          dateTo={sharedProps.dateTo}
          periodLabel={yearLabel}
        />
      )}
      {tab === "activity" && (
        <ActivityPanel
          subjectId={student.user_id}
          profileId={student.id}
          dateFrom={sharedProps.dateFrom}
          dateTo={sharedProps.dateTo}
        />
      )}
    </div>
  );
}
