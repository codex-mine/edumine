"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ActiveBadge, StatusBadge } from "@/components/modules/people/status-badge";
import { ProfileField } from "@/components/modules/people/profile-field";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useOwnStudentProfileQuery } from "@/hooks/use-students";

export default function StudentProfilePage() {
  const { data: student, isLoading, isError, error, refetch } = useOwnStudentProfileQuery();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My profile</h1>
        <p className="text-sm text-muted-foreground">Your student profile as recorded by the institute.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>View-only — contact an administrator to request changes.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState label="Loading your profile..." />
          ) : isError ? (
            <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />
          ) : student ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField label="Full name" value={student.full_name} />
              <ProfileField label="Admission number" value={student.admission_number} />
              <ProfileField label="Email" value={student.email} />
              <ProfileField label="Phone" value={student.phone} />
              <ProfileField label="Admission date" value={student.admission_date} />
              <ProfileField label="Blood group" value={student.blood_group} />
              <ProfileField label="Emergency contact" value={student.emergency_contact} />
              <ProfileField label="Address" value={student.address} />
              <ProfileField label="Status" value={<StatusBadge status={student.status} />} />
              <ProfileField label="Account" value={<ActiveBadge isActive={student.is_active} />} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My guardians</CardTitle>
          <CardDescription>Guardians linked to your record.</CardDescription>
        </CardHeader>
        <CardContent>
          {student && student.guardians.length === 0 ? (
            <EmptyState message="No guardians linked yet." />
          ) : (
            <div className="flex flex-col gap-2">
              {student?.guardians.map((guardian) => (
                <div
                  key={guardian.guardian_id}
                  className="flex items-center justify-between rounded border border-border px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {guardian.full_name}
                      {guardian.is_primary && <Badge variant="default">Primary</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">{guardian.relation}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{guardian.phone}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
