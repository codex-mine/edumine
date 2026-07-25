"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ActiveBadge, StatusBadge } from "@/components/modules/people/status-badge";
import { ProfileField } from "@/components/modules/people/profile-field";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useOwnTeacherProfileQuery } from "@/hooks/use-teachers";

export default function TeacherProfilePage() {
  const { data: teacher, isLoading, isError, error, refetch } = useOwnTeacherProfileQuery();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My profile</h1>
        <p className="text-sm text-muted-foreground">Your teacher profile as recorded by the institute.</p>
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
          ) : teacher ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField label="Full name" value={teacher.full_name} />
              <ProfileField label="Employee code" value={teacher.employee_code} />
              <ProfileField label="Email" value={teacher.email} />
              <ProfileField label="Phone" value={teacher.phone} />
              <ProfileField label="Designation" value={teacher.designation} />
              <ProfileField label="Joining date" value={teacher.joining_date} />
              <ProfileField label="Qualification" value={teacher.qualification} />
              <ProfileField label="Status" value={<StatusBadge status={teacher.status} />} />
              <ProfileField label="Account" value={<ActiveBadge isActive={teacher.is_active} />} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
