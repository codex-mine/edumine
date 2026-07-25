"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ActiveBadge } from "@/components/modules/people/status-badge";
import { ProfileField } from "@/components/modules/people/profile-field";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useOwnGuardianProfileQuery } from "@/hooks/use-guardians";

export default function GuardianProfilePage() {
  const { data: guardian, isLoading, isError, error, refetch } = useOwnGuardianProfileQuery();

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My profile</h1>
        <p className="text-sm text-muted-foreground">Your guardian profile as recorded by the institute.</p>
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
          ) : guardian ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField label="Full name" value={guardian.full_name} />
              <ProfileField label="Occupation" value={guardian.occupation} />
              <ProfileField label="Email" value={guardian.email} />
              <ProfileField label="Phone" value={guardian.phone} />
              <ProfileField label="Address" value={guardian.address} />
              <ProfileField label="Account" value={<ActiveBadge isActive={guardian.is_active} />} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My children</CardTitle>
          <CardDescription>Students linked to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {guardian && guardian.students.length === 0 ? (
            <EmptyState message="No students linked yet." />
          ) : (
            <div className="flex flex-col gap-2">
              {guardian?.students.map((student) => (
                <div
                  key={student.student_id}
                  className="flex items-center justify-between rounded border border-border px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {student.full_name}
                      {student.is_primary && <Badge variant="default">Primary contact</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">{student.relation}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{student.admission_number}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
