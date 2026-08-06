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
  SimpleTable,
  StatGrid,
  StatTile,
} from "@/components/modules/people/detail/detail-shell";
import { PayrollPanel } from "@/components/modules/people/detail/payroll-panel";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAcademicYearsQuery, useActiveAcademicYearQuery } from "@/hooks/use-academic";
import { useDailyAttendanceQuery } from "@/hooks/use-attendance";
import { usePayrollEmployeesQuery } from "@/hooks/use-payroll";
import { useUserAccountQuery } from "@/hooks/use-users";
import type { UserAccountDetail } from "@/lib/api/users";

const BASE_TABS = [
  { value: "overview", label: "Overview" },
  { value: "personal", label: "Personal" },
] as const;

const PAYROLL_TAB = { value: "payroll", label: "Payroll" } as const;

const TAIL_TABS = [
  { value: "attendance", label: "Attendance" },
  { value: "activity", label: "Activity" },
] as const;

type AccountTab = "overview" | "personal" | "payroll" | "attendance" | "activity";

function AccountOverview({
  account,
  yearLabel,
  dateFrom,
  dateTo,
}: {
  account: UserAccountDetail;
  yearLabel?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const attendanceQuery = useDailyAttendanceQuery({
    user_id: account.id,
    date_from: dateFrom,
    date_to: dateTo,
  });

  const records = attendanceQuery.data ?? [];
  const presentish = records.filter((record) => record.status !== "absent").length;
  const rate = records.length > 0 ? Math.round((presentish / records.length) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile
          label="Attendance"
          value={rate === null ? "—" : `${rate}%`}
          hint={yearLabel}
          tone={rate === null ? "default" : rate >= 90 ? "positive" : rate >= 75 ? "warning" : "negative"}
        />
        <StatTile label="Days recorded" value={records.length} hint={yearLabel} />
        <StatTile label="Qualifications" value={account.qualifications.length} />
        <StatTile label="Role" value={account.role.charAt(0).toUpperCase() + account.role.slice(1)} />
      </StatGrid>

      <DetailSection title="At a glance" description="Posting and account status.">
        <div className="text-sm">
          <DetailRow label="Employee #" value={account.employee_code} />
          <DetailRow label="Department" value={account.department} />
          <DetailRow label="Designation" value={account.designation} />
          <DetailRow label="Joining date" value={account.joining_date} />
          <DetailRow
            label="Employment status"
            value={account.status ? <StatusBadge status={account.status} /> : null}
          />
          <DetailRow label="Account" value={<ActiveBadge isActive={account.is_active} />} />
        </div>
      </DetailSection>

      <ActivityPanel
        subjectId={account.id}
        dateFrom={dateFrom}
        dateTo={dateTo}
        description="Recent changes involving this account."
      />
    </div>
  );
}

function AccountPersonal({ account }: { account: UserAccountDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <DetailSection title="Personal information" description="Identity and contact details on record.">
        <div className="text-sm">
          <DetailRow label="Full name" value={account.full_name} />
          <DetailRow label="Email" value={account.email} />
          <DetailRow label="Phone" value={account.phone} />
          <DetailRow label="Gender" value={account.gender} />
          <DetailRow label="Date of birth" value={account.date_of_birth} />
          <DetailRow label="NID number" value={account.nid_number} />
          <DetailRow
            label="NID document"
            value={
              account.nid_document_url ? (
                <a
                  href={account.nid_document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  View
                </a>
              ) : null
            }
          />
          <DetailRow label="Previous employment" value={account.previous_employment} />
        </div>
      </DetailSection>

      <DetailSection title="Qualifications" description="Education history on file.">
        {account.qualifications.length === 0 ? (
          <EmptyState message="No qualifications recorded." />
        ) : (
          <SimpleTable
            headers={["Education", "Institute", "Grade", "Year", "Documents"]}
            rows={account.qualifications.map((qualification) => [
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

/** Payroll keys staff by their Staff-profile id, which the account payload does
 * not carry — the employee roster is the only place both live, so match on the
 * employee code they share. */
function AccountPayroll({ employeeCode }: { employeeCode: string }) {
  const employeesQuery = usePayrollEmployeesQuery();
  const employee = (employeesQuery.data ?? []).find((row) => row.employee_code === employeeCode);

  if (employeesQuery.isPending) return <LoadingState label="Loading payroll..." />;
  if (employeesQuery.isError) {
    return (
      <ErrorState message={loginErrorMessage(employeesQuery.error)} onRetry={() => employeesQuery.refetch()} />
    );
  }
  if (!employee?.staff_id) {
    return (
      <DetailSection title="Payroll" description="Salary structure and payslip history.">
        <EmptyState message="This account is not set up for payroll yet." />
      </DetailSection>
    );
  }

  return <PayrollPanel staffId={employee.staff_id} />;
}

export default function AdminAccountDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [tab, setTab] = useState<AccountTab>("overview");
  const [selectedYearOverride, setSelectedYearOverride] = useState("");

  const accountQuery = useUserAccountQuery(userId);
  const activeYearQuery = useActiveAcademicYearQuery();
  const yearsQuery = useAcademicYearsQuery();

  const selectedYearId = selectedYearOverride || activeYearQuery.data?.id || "";
  const selectedYear = (yearsQuery.data ?? []).find((year) => year.id === selectedYearId);
  const yearLabel = selectedYear?.name;

  const account = accountQuery.data;

  if (accountQuery.isPending) return <LoadingState label="Loading account..." />;
  if (accountQuery.isError) {
    return <ErrorState message={loginErrorMessage(accountQuery.error)} onRetry={() => accountQuery.refetch()} />;
  }
  if (!account) return <EmptyState message="Account not found." />;

  // Admins have no Staff profile, so there is no payroll to show them.
  const tabs = account.employee_code
    ? [...BASE_TABS, PAYROLL_TAB, ...TAIL_TABS]
    : [...BASE_TABS, ...TAIL_TABS];

  return (
    <div className="flex w-full flex-col gap-5">
      <DetailPageHeader
        backHref="/admin/accounts"
        backLabel="Staff & accounts"
        title={account.full_name}
        subtitle={[account.employee_code, account.designation ?? account.role].filter(Boolean).join(" · ")}
        meta={
          <>
            <Badge variant="muted">{account.role}</Badge>
            {account.department && <Badge variant="info">{account.department}</Badge>}
            {account.status && <StatusBadge status={account.status} />}
            <ActiveBadge isActive={account.is_active} />
          </>
        }
        actions={<AcademicYearSelect value={selectedYearId} onChange={setSelectedYearOverride} />}
      />

      <DetailTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <AccountOverview
          account={account}
          yearLabel={yearLabel}
          dateFrom={selectedYear?.start_date}
          dateTo={selectedYear?.end_date}
        />
      )}
      {tab === "personal" && <AccountPersonal account={account} />}
      {tab === "payroll" && account.employee_code && (
        <AccountPayroll employeeCode={account.employee_code} />
      )}
      {tab === "attendance" && (
        <AttendancePanel
          userId={account.id}
          dateFrom={selectedYear?.start_date}
          dateTo={selectedYear?.end_date}
          periodLabel={yearLabel}
        />
      )}
      {tab === "activity" && (
        <ActivityPanel
          subjectId={account.id}
          dateFrom={selectedYear?.start_date}
          dateTo={selectedYear?.end_date}
        />
      )}
    </div>
  );
}
