"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ActiveBadge } from "@/components/modules/people/status-badge";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useUserAccountQuery } from "@/hooks/use-users";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function UserAccountDetailDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const accountQuery = useUserAccountQuery(open ? userId : null);
  const account = accountQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account details</DialogTitle>
          <DialogDescription>Complete profile, documents, and qualifications.</DialogDescription>
        </DialogHeader>

        {accountQuery.isLoading ? (
          <LoadingState label="Loading account..." />
        ) : accountQuery.isError ? (
          <ErrorState message={loginErrorMessage(accountQuery.error)} onRetry={() => accountQuery.refetch()} />
        ) : account ? (
          <div className="flex flex-col gap-4 text-sm">
            <div className="rounded border border-border p-3">
              <DetailRow label="Full name" value={account.full_name} />
              <DetailRow label="Role" value={<span className="capitalize">{account.role}</span>} />
              {account.employee_code && <DetailRow label="Employee #" value={account.employee_code} />}
              {account.department && <DetailRow label="Department" value={account.department} />}
              {account.designation && <DetailRow label="Designation" value={account.designation} />}
              <DetailRow label="Account" value={<ActiveBadge isActive={account.is_active} />} />
              <DetailRow label="Email" value={account.email} />
              <DetailRow label="Phone" value={account.phone} />
              <DetailRow label="Gender" value={account.gender} />
              <DetailRow label="Date of birth" value={account.date_of_birth} />
              {account.joining_date && <DetailRow label="Joining date" value={account.joining_date} />}
              {account.nid_number && <DetailRow label="NID number" value={account.nid_number} />}
              {account.nid_document_url && (
                <DetailRow
                  label="NID document"
                  value={
                    <a href={account.nid_document_url} target="_blank" rel="noreferrer" className="text-primary underline">
                      View
                    </a>
                  }
                />
              )}
              {account.previous_employment && (
                <DetailRow label="Previous employment" value={account.previous_employment} />
              )}
            </div>

            {account.role !== "admin" && (
              <div className="flex flex-col gap-2">
                <p className="font-medium text-foreground">Qualifications</p>
                {account.qualifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No qualifications on record.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {account.qualifications.map((q) => (
                      <div key={q.id} className="rounded border border-border p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{q.education_title}</span>
                          <span className="text-xs text-muted-foreground">{q.passing_year ?? "—"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {q.institute}
                          {q.grade ? ` · ${q.grade}` : ""}
                        </p>
                        {q.additional_info && <p className="pt-1 text-xs text-muted-foreground">{q.additional_info}</p>}
                        <div className="flex gap-3 pt-1 text-xs">
                          {q.certificate_url && (
                            <a href={q.certificate_url} target="_blank" rel="noreferrer" className="text-primary underline">
                              Certificate
                            </a>
                          )}
                          {q.marksheet_url && (
                            <a href={q.marksheet_url} target="_blank" rel="noreferrer" className="text-primary underline">
                              Marksheet
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
