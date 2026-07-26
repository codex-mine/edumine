"use client";

import { useState } from "react";
import { PartyPopper, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckboxUi } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { QualificationsEditor } from "@/components/modules/people/qualifications-editor";
import { useCreateUserAccountMutation, useUpdateUserAccountMutation, useUserAccountQuery } from "@/hooks/use-users";
import { loginErrorMessage } from "@/hooks/use-auth";
import type { QualificationInput } from "@/lib/api/qualifications";
import { STAFF_DESIGNATIONS, type CreateUserAccountResult, type UserAccount, type UserAccountRole } from "@/lib/api/users";
import type { Role } from "@/lib/auth/roles";

const STAFF_LIKE: UserAccountRole[] = ["staff", "accountant", "receptionist"];

export function UserAccountFormDialog({
  trigger,
  account,
  currentUserRole,
}: {
  trigger: React.ReactNode;
  account?: UserAccount;
  currentUserRole: Role;
}) {
  const isEdit = Boolean(account);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserAccountRole>(account?.role ?? "staff");
  const [fullName, setFullName] = useState(account?.full_name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(account?.date_of_birth ?? "");
  const [department, setDepartment] = useState(account?.department ?? "");
  const initialDesignationIsPreset =
    !account?.designation || (STAFF_DESIGNATIONS as readonly string[]).includes(account.designation);
  const [designationPreset, setDesignationPreset] = useState(
    initialDesignationIsPreset ? account?.designation ?? "" : "Other"
  );
  const [designationCustom, setDesignationCustom] = useState(
    initialDesignationIsPreset ? "" : account?.designation ?? ""
  );
  const designation = designationPreset === "Other" ? designationCustom : designationPreset;
  const [joiningDate, setJoiningDate] = useState(account?.joining_date ?? "");
  const [nidNumber, setNidNumber] = useState(account?.nid_number ?? "");
  const [nidDocumentUrl, setNidDocumentUrl] = useState<string | null>(account?.nid_document_url ?? null);
  const [previousEmployment, setPreviousEmployment] = useState(account?.previous_employment ?? "");
  const [qualifications, setQualifications] = useState<QualificationInput[]>([]);
  const [isActive, setIsActive] = useState(account?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserAccountResult | null>(null);
  const [hydratedQualificationsFor, setHydratedQualificationsFor] = useState<string | null>(null);

  const accountDetailQuery = useUserAccountQuery(isEdit && account && open ? account.id : null);

  if (accountDetailQuery.data && hydratedQualificationsFor !== accountDetailQuery.data.id) {
    setHydratedQualificationsFor(accountDetailQuery.data.id);
    setQualifications(
      accountDetailQuery.data.qualifications.map((q) => ({
        education_title: q.education_title,
        institute: q.institute,
        grade: q.grade,
        passing_year: q.passing_year,
        additional_info: q.additional_info,
        certificate_url: q.certificate_url,
        marksheet_url: q.marksheet_url,
      }))
    );
  }

  const createMutation = useCreateUserAccountMutation();
  const updateMutation = useUpdateUserAccountMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const isStaffLike = STAFF_LIKE.includes(role);
  const editIsStaffLike = account ? account.role !== "admin" : false;

  const roleOptions: UserAccountRole[] =
    currentUserRole === "principal" ? ["admin", "staff", "accountant", "receptionist"] : STAFF_LIKE;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCreated(null);
      setError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && account) {
        await updateMutation.mutateAsync({
          userId: account.id,
          payload: {
            full_name: fullName,
            email,
            phone,
            is_active: isActive,
            ...(editIsStaffLike
              ? {
                  department,
                  designation,
                  nid_number: nidNumber || null,
                  nid_document_url: nidDocumentUrl,
                  previous_employment: previousEmployment || null,
                  qualifications,
                }
              : {}),
          },
        });
        setOpen(false);
      } else {
        const result = await createMutation.mutateAsync({
          role,
          full_name: fullName,
          email,
          phone,
          ...(role === "admin" ? { password } : { date_of_birth: dateOfBirth }),
          ...(isStaffLike
            ? {
                department,
                designation,
                joining_date: joiningDate,
                nid_number: nidNumber || null,
                nid_document_url: nidDocumentUrl,
                previous_employment: previousEmployment || null,
                qualifications,
              }
            : {}),
        });
        if (result.temporary_password) {
          setCreated(result);
        } else {
          setOpen(false);
        }
      }
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PartyPopper className="size-5 text-primary" aria-hidden="true" />
                Account created
              </DialogTitle>
              <DialogDescription>
                Share these details — the password won&apos;t be shown again. A welcome email with these credentials
                has also been sent.
              </DialogDescription>
            </DialogHeader>

            <div className="print-area flex flex-col gap-2 rounded border border-border p-3 text-sm">
              <p className="hidden pb-2 text-base font-semibold print:block">Account registration slip</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground">{created.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Employee #</span>
                <span className="font-medium text-foreground">{created.employee_code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Designation</span>
                <span className="font-medium text-foreground">{created.designation ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Login email</span>
                <span className="font-medium text-foreground">{created.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Temporary password</span>
                <span className="font-mono font-medium text-foreground">{created.temporary_password}</span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Password is the account holder&apos;s date of birth (DDMMYYYY). They should change it after first login.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer className="size-6" aria-hidden="true" />
                Print
              </Button>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit account" : "Create account"}</DialogTitle>
              <DialogDescription>
                {isEdit ? "Update this account's details." : "Creates an Admin, Staff, Accountant, or Receptionist account."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {!isEdit && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as UserAccountRole)}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
              </div>

              {!isEdit && role === "admin" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              )}

              {!isEdit && role !== "admin" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">Used as the account&apos;s login password (DDMMYYYY).</p>
                </div>
              )}

              {(isEdit ? editIsStaffLike : isStaffLike) && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="department">Department</Label>
                      <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="designation">Designation</Label>
                      <Select
                        value={designationPreset || undefined}
                        onValueChange={(value) => {
                          setDesignationPreset(value);
                          if (value !== "Other") setDesignationCustom("");
                        }}
                      >
                        <SelectTrigger id="designation">
                          <SelectValue placeholder="Select designation" />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_DESIGNATIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {designationPreset === "Other" && (
                        <Input
                          value={designationCustom}
                          onChange={(e) => setDesignationCustom(e.target.value)}
                          placeholder="Specify designation"
                        />
                      )}
                    </div>
                  </div>

                  {!isEdit && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="joining_date">Joining date</Label>
                      <Input
                        id="joining_date"
                        type="date"
                        value={joiningDate}
                        onChange={(e) => setJoiningDate(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <QualificationsEditor qualifications={qualifications} onChange={setQualifications} />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="nid_number">NID number</Label>
                      <Input id="nid_number" value={nidNumber} onChange={(e) => setNidNumber(e.target.value)} />
                    </div>
                    <FileUploadField label="NID card upload" value={nidDocumentUrl} onChange={setNidDocumentUrl} />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="previous_employment">Previous employment (optional)</Label>
                    <Textarea
                      id="previous_employment"
                      value={previousEmployment}
                      onChange={(e) => setPreviousEmployment(e.target.value)}
                      rows={2}
                      placeholder="Previous employer, designation, and duration"
                    />
                  </div>
                </>
              )}

              {isEdit && (
                <div className="flex items-center gap-2">
                  <CheckboxUi
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked === true)}
                  />
                  <Label htmlFor="is_active">Account active</Label>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isEdit ? "Save changes" : "Create account"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
