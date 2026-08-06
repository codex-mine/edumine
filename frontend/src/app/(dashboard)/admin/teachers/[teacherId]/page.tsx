"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

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
  SimpleTable,
  StatGrid,
  StatTile,
} from "@/components/modules/people/detail/detail-shell";
import { PayrollPanel } from "@/components/modules/people/detail/payroll-panel";
import { TeachingPanel } from "@/components/modules/people/detail/teaching-panel";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAcademicYearsQuery, useActiveAcademicYearQuery, useClassSubjectsQuery } from "@/hooks/use-academic";
import { useDailyAttendanceQuery } from "@/hooks/use-attendance";
import { useCurrentSalaryStructureQuery } from "@/hooks/use-payroll";
import { useRoutineSlotsQuery } from "@/hooks/use-routine";
import { useTeacherQuery } from "@/hooks/use-teachers";
import type { TeacherDetail } from "@/lib/api/teachers";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "personal", label: "Personal" },
  { value: "teaching", label: "Teaching" },
  { value: "payroll", label: "Payroll" },
  { value: "attendance", label: "Attendance" },
  { value: "activity", label: "Activity" },
] as const;

type TeacherTab = (typeof TABS)[number]["value"];

const currency = (amount: number) => `৳${amount.toLocaleString()}`;

function TeacherOverview({
  teacher,
  academicYearId,
  yearLabel,
  dateFrom,
  dateTo,
}: {
  teacher: TeacherDetail;
  academicYearId?: string;
  yearLabel?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const attendanceQuery = useDailyAttendanceQuery({
    user_id: teacher.user_id,
    date_from: dateFrom,
    date_to: dateTo,
  });
  const routineQuery = useRoutineSlotsQuery({ academic_year_id: academicYearId, teacher_id: teacher.id });
  const classSubjectsQuery = useClassSubjectsQuery({ academic_year_id: academicYearId });
  const salaryQuery = useCurrentSalaryStructureQuery({ teacher_id: teacher.id });

  const records = attendanceQuery.data ?? [];
  const presentish = records.filter((record) => record.status !== "absent").length;
  const rate = records.length > 0 ? Math.round((presentish / records.length) * 100) : null;
  const assignments = (classSubjectsQuery.data ?? []).filter((row) => row.teacher_id === teacher.id);

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile
          label="Attendance"
          value={rate === null ? "—" : `${rate}%`}
          hint={yearLabel}
          tone={rate === null ? "default" : rate >= 90 ? "positive" : rate >= 75 ? "warning" : "negative"}
        />
        <StatTile label="Weekly periods" value={routineQuery.data?.length ?? 0} hint={yearLabel} />
        <StatTile label="Subjects assigned" value={assignments.length} hint={yearLabel} />
        <StatTile
          label="Current gross"
          value={salaryQuery.data ? currency(salaryQuery.data.gross_salary) : "—"}
        />
      </StatGrid>

      <DetailSection title="At a glance" description="Employment status and posting.">
        <div className="text-sm">
          <DetailRow label="Employee #" value={teacher.employee_code} />
          <DetailRow label="Designation" value={teacher.designation} />
          <DetailRow label="Joining date" value={teacher.joining_date} />
          <DetailRow label="Employment status" value={<StatusBadge status={teacher.status} />} />
          <DetailRow label="Account" value={<ActiveBadge isActive={teacher.is_active} />} />
        </div>
      </DetailSection>

      <ActivityPanel
        subjectId={teacher.user_id}
        profileId={teacher.id}
        dateFrom={dateFrom}
        dateTo={dateTo}
        description="Recent changes involving this teacher."
      />
    </div>
  );
}

function TeacherPersonal({ teacher }: { teacher: TeacherDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <DetailSection title="Personal information" description="Identity and contact details on record.">
        <div className="text-sm">
          <DetailRow label="Full name" value={teacher.full_name} />
          <DetailRow label="Email" value={teacher.email} />
          <DetailRow label="Phone" value={teacher.phone} />
          <DetailRow label="Gender" value={teacher.gender} />
          <DetailRow label="Date of birth" value={teacher.date_of_birth} />
          <DetailRow label="NID number" value={teacher.nid_number} />
          <DetailRow
            label="NID document"
            value={
              teacher.nid_document_url ? (
                <a
                  href={teacher.nid_document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  View
                </a>
              ) : null
            }
          />
          <DetailRow label="Previous employment" value={teacher.previous_employment} />
        </div>
      </DetailSection>

      <DetailSection title="Qualifications" description="Education history on file.">
        {teacher.qualifications.length === 0 ? (
          <EmptyState message="No qualifications recorded." />
        ) : (
          <SimpleTable
            headers={["Education", "Institute", "Grade", "Year", "Documents"]}
            rows={teacher.qualifications.map((qualification) => [
              qualification.education_title,
              qualification.institute,
              qualification.grade ?? "—",
              qualification.passing_year ?? "—",
              <span key={qualification.id} className="flex gap-2">
                {qualification.certificate_url && (
                  <a
                    href={qualification.certificate_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Certificate
                  </a>
                )}
                {qualification.marksheet_url && (
                  <a
                    href={qualification.marksheet_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Marksheet
                  </a>
                )}
                {!qualification.certificate_url && !qualification.marksheet_url && "—"}
              </span>,
            ])}
          />
        )}
      </DetailSection>
    </div>
  );
}

export default function AdminTeacherDetailPage() {
  const params = useParams<{ teacherId: string }>();
  const teacherId = params.teacherId;

  const [tab, setTab] = useState<TeacherTab>("overview");
  const [selectedYearOverride, setSelectedYearOverride] = useState("");

  const teacherQuery = useTeacherQuery(teacherId);
  const activeYearQuery = useActiveAcademicYearQuery();
  const yearsQuery = useAcademicYearsQuery();

  const selectedYearId = selectedYearOverride || activeYearQuery.data?.id || "";
  const selectedYear = (yearsQuery.data ?? []).find((year) => year.id === selectedYearId);
  const yearLabel = selectedYear?.name;

  const teacher = teacherQuery.data;

  if (teacherQuery.isPending) return <LoadingState label="Loading teacher..." />;
  if (teacherQuery.isError) {
    return <ErrorState message={loginErrorMessage(teacherQuery.error)} onRetry={() => teacherQuery.refetch()} />;
  }
  if (!teacher) return <EmptyState message="Teacher not found." />;

  return (
    <div className="flex w-full flex-col gap-5">
      <DetailPageHeader
        backHref="/admin/teachers"
        backLabel="Teachers"
        title={teacher.full_name}
        subtitle={`${teacher.employee_code} · ${teacher.designation ?? "No designation"}`}
        meta={
          <>
            <StatusBadge status={teacher.status} />
            <ActiveBadge isActive={teacher.is_active} />
          </>
        }
        actions={<AcademicYearSelect value={selectedYearId} onChange={setSelectedYearOverride} />}
      />

      <DetailTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <TeacherOverview
          teacher={teacher}
          academicYearId={selectedYearId || undefined}
          yearLabel={yearLabel}
          dateFrom={selectedYear?.start_date}
          dateTo={selectedYear?.end_date}
        />
      )}
      {tab === "personal" && <TeacherPersonal teacher={teacher} />}
      {tab === "teaching" && (
        <TeachingPanel
          teacherId={teacher.id}
          academicYearId={selectedYearId || undefined}
          yearLabel={yearLabel}
        />
      )}
      {tab === "payroll" && <PayrollPanel teacherId={teacher.id} />}
      {tab === "attendance" && (
        <AttendancePanel
          userId={teacher.user_id}
          dateFrom={selectedYear?.start_date}
          dateTo={selectedYear?.end_date}
          periodLabel={yearLabel}
        />
      )}
      {tab === "activity" && (
        <ActivityPanel
          subjectId={teacher.user_id}
          profileId={teacher.id}
          dateFrom={selectedYear?.start_date}
          dateTo={selectedYear?.end_date}
        />
      )}
    </div>
  );
}
