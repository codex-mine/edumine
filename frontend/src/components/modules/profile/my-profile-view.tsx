"use client";

import { BookOpen, Briefcase, GraduationCap, HeartHandshake, IdCard, Settings, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/modules/people/status-badge";
import {
  DocumentLink,
  ProfileColumns,
  ProfileIdentityCard,
  ProfileInfoCard,
  ProfileLinkedRow,
  ProfileTabs,
  type ProfileFieldSpec,
} from "@/components/modules/profile/profile-shell";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useOwnGuardianProfileQuery } from "@/hooks/use-guardians";
import { useOwnStudentProfileQuery } from "@/hooks/use-students";
import { useOwnTeacherProfileQuery } from "@/hooks/use-teachers";
import { useOwnUserAccountQuery } from "@/hooks/use-users";
import type { Qualification } from "@/lib/api/qualifications";
import type { GuardianDetail } from "@/lib/api/guardians";
import type { StudentDetail } from "@/lib/api/students";
import type { TeacherDetail } from "@/lib/api/teachers";
import type { OwnUserAccount } from "@/lib/api/users";
import type { Role } from "@/lib/auth/roles";
import { formatDateWithTenure, formatLongDate } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

const ROLE_LABELS: Record<Role, string> = {
  principal: "Principal",
  admin: "Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  receptionist: "Receptionist",
  staff: "Staff",
  student: "Student",
  guardian: "Guardian",
};

/** Roles whose employment details live on a Staff record (`/users/me` carries
 * them inline); teacher keeps its own profile, and admin/principal have none. */
const STAFF_LIKE_ROLES: Role[] = ["staff", "accountant", "receptionist"];

type ProfileTab = "personal" | "employment" | "education" | "academics" | "family";

const TAB_LABELS: Record<ProfileTab, string> = {
  personal: "Personal",
  employment: "Employment",
  education: "Education",
  academics: "Academics",
  family: "Family",
};

function tabsForRole(role: Role): ProfileTab[] {
  if (role === "student") return ["personal", "academics"];
  if (role === "guardian") return ["personal", "family"];
  if (role === "teacher" || STAFF_LIKE_ROLES.includes(role)) return ["personal", "employment", "education"];
  return ["personal"];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** The one person record this view is about, flattened out of whichever
 * role-specific endpoint holds it. Every tab reads from this shape so the cards
 * stay free of role branching. */
interface ProfileData {
  role: Role;
  account: OwnUserAccount;
  teacher?: TeacherDetail;
  student?: StudentDetail;
  guardian?: GuardianDetail;
}

function EducationList({ qualifications }: { qualifications: Qualification[] }) {
  if (qualifications.length === 0) {
    return <EmptyState message="No education records on file yet." />;
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {qualifications.map((qualification) => (
        <div key={qualification.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{qualification.education_title}</span>
            <span className="text-xs text-muted-foreground">{qualification.institute}</span>
            <span className="mt-1 flex flex-wrap items-center gap-3 text-xs">
              {qualification.grade && <span className="text-muted-foreground">Grade: {qualification.grade}</span>}
              {qualification.certificate_url && <DocumentLink url={qualification.certificate_url} label="Certificate" />}
              {qualification.marksheet_url && <DocumentLink url={qualification.marksheet_url} label="Marksheet" />}
            </span>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">{qualification.passing_year ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function PersonalTab({ data }: { data: ProfileData }) {
  const { role, account, student, guardian, teacher } = data;

  const personalFields: ProfileFieldSpec[] = [
    { label: "Gender", value: account.gender ? capitalize(account.gender) : null },
    { label: "Date of birth", value: formatLongDate(account.date_of_birth) },
    { label: "Phone number", value: account.phone },
    { label: "Email", value: account.email },
  ];
  if (student) {
    personalFields.push({ label: "Blood group", value: student.blood_group });
    personalFields.push({ label: "Address", value: student.address });
  }
  if (guardian) {
    personalFields.push({ label: "Occupation", value: guardian.occupation });
    personalFields.push({ label: "Address", value: guardian.address });
  }
  const nidNumber = teacher?.nid_number ?? account.nid_number;
  if (nidNumber) {
    personalFields.push({ label: "Identity document", value: nidNumber });
  }

  const accountFields: ProfileFieldSpec[] = [
    { label: "Role", value: ROLE_LABELS[role] },
    { label: "Login phone", value: account.phone },
    { label: "Login email", value: account.email },
    { label: "Member since", value: formatLongDate(account.created_at) },
  ];

  const primaryGuardian = student?.guardians.find((entry) => entry.is_primary) ?? student?.guardians[0];

  return (
    <ProfileColumns
      left={
        <ProfileInfoCard
          title="Personal information"
          icon={UserRound}
          description="Identity and contact details the institute holds for you."
          fields={personalFields}
        />
      }
      right={
        <>
          <ProfileInfoCard
            title="Account information"
            icon={ShieldCheck}
            description="How you sign in to Codex Edumine."
            fields={accountFields}
          >
            <Button variant="outline"   asChild className="w-fit">
              <Link href="/settings">Change password</Link>
            </Button>
          </ProfileInfoCard>

          {student && (
            <ProfileInfoCard
              title="Emergency contact"
              icon={HeartHandshake}
              fields={[
                { label: "Emergency number", value: student.emergency_contact },
                { label: "Name", value: primaryGuardian?.full_name },
                { label: "Relationship", value: primaryGuardian?.relation },
                { label: "Phone number", value: primaryGuardian?.phone },
              ]}
            />
          )}
        </>
      }
    />
  );
}

function EmploymentTab({ data }: { data: ProfileData }) {
  const { account, teacher } = data;

  // Teachers carry their posting on the Teacher record; staff-like roles have it
  // inline on the account payload. Everything below reads whichever is present.
  const employmentFields: ProfileFieldSpec[] = [
    { label: "Employee code", value: teacher?.employee_code ?? account.employee_code },
    { label: "Designation", value: teacher?.designation ?? account.designation },
    { label: "Department", value: account.department },
    { label: "Joining date", value: formatLongDate(teacher?.joining_date ?? account.joining_date) },
  ];
  const status = teacher?.status ?? account.status;
  employmentFields.push({
    label: "Employment status",
    value: status ? <StatusBadge status={status} /> : null,
  });

  return (
    <ProfileColumns
      left={
        <ProfileInfoCard
          title="Employment information"
          icon={Briefcase}
          description="Your posting as recorded by the institute."
          fields={employmentFields}
        />
      }
      right={
        <ProfileInfoCard
          title="Documents"
          icon={IdCard}
          description="Identity papers and employment history on file."
          fields={[
            { label: "Identity document number", value: teacher?.nid_number ?? account.nid_number },
            {
              label: "Identity document",
              value: <DocumentLink url={teacher?.nid_document_url ?? account.nid_document_url} label="View document" />,
            },
            {
              label: "Previous employment",
              value: teacher?.previous_employment ?? account.previous_employment,
            },
          ]}
        />
      }
    />
  );
}

function EducationTab({ data }: { data: ProfileData }) {
  const { account, teacher } = data;
  const qualifications = teacher?.qualifications ?? account.qualifications;

  return (
    <div className="flex flex-col gap-4">
      <ProfileInfoCard
        title="Education information"
        icon={GraduationCap}
        description="Degrees and certificates recorded against your account."
      >
        <EducationList qualifications={qualifications} />
      </ProfileInfoCard>

      {teacher?.qualification && (
        <ProfileInfoCard
          title="Qualification summary"
          icon={BookOpen}
          fields={[{ label: "Summary", value: teacher.qualification }]}
        />
      )}
    </div>
  );
}

function AcademicsTab({ student }: { student: StudentDetail }) {
  return (
    <ProfileColumns
      left={
        <ProfileInfoCard
          title="Academic information"
          icon={BookOpen}
          description="Your admission and current placement."
          fields={[
            { label: "Admission number", value: student.admission_number },
            { label: "Admission date", value: formatLongDate(student.admission_date) },
            { label: "Class", value: student.class_name },
            { label: "Section", value: student.section_name },
            { label: "Roll number", value: student.roll_number },
            { label: "Status", value: <StatusBadge status={student.status} /> },
          ]}
        />
      }
      right={
        <ProfileInfoCard
          title="My guardians"
          icon={HeartHandshake}
          description="Guardians linked to your record."
        >
          {student.guardians.length === 0 ? (
            <EmptyState message="No guardians linked yet." />
          ) : (
            <div className="flex flex-col gap-2">
              {student.guardians.map((entry) => (
                <ProfileLinkedRow
                  key={entry.guardian_id}
                  name={entry.full_name}
                  meta={entry.relation}
                  trailing={entry.phone}
                  isPrimary={entry.is_primary}
                />
              ))}
            </div>
          )}
        </ProfileInfoCard>
      }
    />
  );
}

function FamilyTab({ guardian }: { guardian: GuardianDetail }) {
  return (
    <ProfileInfoCard
      title="My children"
      icon={HeartHandshake}
      description="Students linked to your guardian account."
    >
      {guardian.students.length === 0 ? (
        <EmptyState message="No students linked yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {guardian.students.map((entry) => (
            <ProfileLinkedRow
              key={entry.student_id}
              name={entry.full_name}
              meta={entry.relation}
              trailing={entry.admission_number}
              isPrimary={entry.is_primary}
            />
          ))}
        </div>
      )}
    </ProfileInfoCard>
  );
}

/** "Started on …" for employees, "Admitted on …" for students, and the plain
 * account age for everyone else — whichever date actually marks their tenure. */
function tenureLine(data: ProfileData): string | null {
  const { account, teacher, student } = data;
  const joining = teacher?.joining_date ?? account.joining_date;
  if (joining) {
    const formatted = formatDateWithTenure(joining);
    return formatted && `Started on ${formatted}`;
  }
  if (student) {
    const formatted = formatDateWithTenure(student.admission_date);
    return formatted && `Admitted on ${formatted}`;
  }
  const formatted = formatDateWithTenure(account.created_at);
  return formatted && `Member since ${formatted}`;
}

export function MyProfileView() {
  const { user } = useAuth();
  const role = user?.role ?? null;

  const accountQuery = useOwnUserAccountQuery();
  const teacherQuery = useOwnTeacherProfileQuery({ enabled: role === "teacher" });
  const studentQuery = useOwnStudentProfileQuery({ enabled: role === "student" });
  const guardianQuery = useOwnGuardianProfileQuery({ enabled: role === "guardian" });
  const [tab, setTab] = useState<ProfileTab>("personal");

  // The dashboard layout blocks rendering until the session resolves, so a null
  // role here only ever means "signing out".
  if (!role) return null;

  const tabs = tabsForRole(role);
  // A re-login as a different role can leave the selection on a tab this role
  // does not have.
  const activeTab = tabs.includes(tab) ? tab : "personal";

  const roleQuery =
    role === "teacher" ? teacherQuery : role === "student" ? studentQuery : role === "guardian" ? guardianQuery : null;

  if (accountQuery.isPending || roleQuery?.isPending) {
    return <LoadingState label="Loading your profile..." />;
  }
  if (accountQuery.isError) {
    return <ErrorState message={loginErrorMessage(accountQuery.error)} onRetry={() => accountQuery.refetch()} />;
  }
  if (roleQuery?.isError) {
    return <ErrorState message={loginErrorMessage(roleQuery.error)} onRetry={() => roleQuery.refetch()} />;
  }
  if (!accountQuery.data) {
    return <EmptyState message="Your profile could not be loaded." />;
  }

  const data: ProfileData = {
    role,
    account: accountQuery.data,
    teacher: teacherQuery.data,
    student: studentQuery.data,
    guardian: guardianQuery.data,
  };
  const { account, teacher, student } = data;
  const employmentStatus = teacher?.status ?? account.status;

  return (
    <div className="flex w-full flex-col gap-4">
      <ProfileIdentityCard
        fullName={account.full_name}
        photoUrl={account.profile_photo_url}
        roleLabel={ROLE_LABELS[role]}
        email={account.email}
        tenureLine={tenureLine(data)}
        isActive={account.is_active}
        badges={
          <>
            {account.department && <Badge variant="info">{account.department}</Badge>}
            {employmentStatus && <StatusBadge status={employmentStatus} />}
            {student && <StatusBadge status={student.status} />}
          </>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="size-8" aria-hidden="true" />
              Account settings
            </Link>
          </Button>
        }
      >
        {/* Admin and Principal hold only personal details, and a lone tab is a
            label rather than a choice — so they get no tab bar at all. */}
        {tabs.length > 1 ? (
          <ProfileTabs
            tabs={tabs.map((value) => ({ value, label: TAB_LABELS[value] }))}
            value={activeTab}
            onChange={setTab}
          />
        ) : null}
      </ProfileIdentityCard>

      {activeTab === "personal" && <PersonalTab data={data} />}
      {activeTab === "employment" && <EmploymentTab data={data} />}
      {activeTab === "education" && <EducationTab data={data} />}
      {activeTab === "academics" && student && <AcademicsTab student={student} />}
      {activeTab === "family" && data.guardian && <FamilyTab guardian={data.guardian} />}

      <p className="text-xs text-muted-foreground">
        These records are maintained by the institute. Contact an administrator to correct anything shown here — you can
        change your own password from{" "}
        <Link href="/settings" className="text-primary hover:underline">
          account settings
        </Link>
        .
      </p>
    </div>
  );
}
