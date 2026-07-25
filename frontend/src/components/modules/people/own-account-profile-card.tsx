"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ActiveBadge } from "@/components/modules/people/status-badge";
import { ProfileField } from "@/components/modules/people/profile-field";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useOwnUserAccountQuery } from "@/hooks/use-users";

export function OwnAccountProfileCard() {
  const { data: account, isLoading, isError, error, refetch } = useOwnUserAccountQuery();

  return (
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
        ) : account ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField label="Full name" value={account.full_name} />
            <ProfileField label="Role" value={<span className="capitalize">{account.role}</span>} />
            <ProfileField label="Email" value={account.email} />
            <ProfileField label="Phone" value={account.phone} />
            {account.employee_code && <ProfileField label="Employee code" value={account.employee_code} />}
            {account.department && <ProfileField label="Department" value={account.department} />}
            {account.designation && <ProfileField label="Designation" value={account.designation} />}
            {account.joining_date && <ProfileField label="Joining date" value={account.joining_date} />}
            <ProfileField label="Account" value={<ActiveBadge isActive={account.is_active} />} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
