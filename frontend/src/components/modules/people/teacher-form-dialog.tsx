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
import { useCreateTeacherMutation, useTeacherQuery, useUpdateTeacherMutation } from "@/hooks/use-teachers";
import { loginErrorMessage } from "@/hooks/use-auth";
import type { QualificationInput } from "@/lib/api/qualifications";
import { TEACHER_DESIGNATIONS, type CreateTeacherResult, type Teacher } from "@/lib/api/teachers";

export function TeacherFormDialog({ trigger, teacher }: { trigger: React.ReactNode; teacher?: Teacher }) {
  const isEdit = Boolean(teacher);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(teacher?.full_name ?? "");
  const [email, setEmail] = useState(teacher?.email ?? "");
  const [phone, setPhone] = useState(teacher?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(teacher?.date_of_birth ?? "");
  const [employeeCode, setEmployeeCode] = useState(teacher?.employee_code ?? "");
  const [joiningDate, setJoiningDate] = useState(teacher?.joining_date ?? "");
  const initialDesignationIsPreset =
    !teacher?.designation || (TEACHER_DESIGNATIONS as readonly string[]).includes(teacher.designation);
  const [designationPreset, setDesignationPreset] = useState(
    initialDesignationIsPreset ? teacher?.designation ?? "" : "Other"
  );
  const [designationCustom, setDesignationCustom] = useState(initialDesignationIsPreset ? "" : teacher?.designation ?? "");
  const designation = designationPreset === "Other" ? designationCustom : designationPreset;
  const [qualification, setQualification] = useState(teacher?.qualification ?? "");
  const [nidNumber, setNidNumber] = useState(teacher?.nid_number ?? "");
  const [nidDocumentUrl, setNidDocumentUrl] = useState<string | null>(teacher?.nid_document_url ?? null);
  const [previousEmployment, setPreviousEmployment] = useState(teacher?.previous_employment ?? "");
  const [qualifications, setQualifications] = useState<QualificationInput[]>([]);
  const [isActive, setIsActive] = useState(teacher?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateTeacherResult | null>(null);
  const [hydratedQualificationsFor, setHydratedQualificationsFor] = useState<string | null>(null);

  const teacherDetailQuery = useTeacherQuery(isEdit && teacher && open ? teacher.id : null);

  if (teacherDetailQuery.data && hydratedQualificationsFor !== teacherDetailQuery.data.id) {
    setHydratedQualificationsFor(teacherDetailQuery.data.id);
    setQualifications(
      teacherDetailQuery.data.qualifications.map((q) => ({
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

  const createMutation = useCreateTeacherMutation();
  const updateMutation = useUpdateTeacherMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

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
      if (isEdit && teacher) {
        await updateMutation.mutateAsync({
          teacherId: teacher.id,
          payload: {
            full_name: fullName,
            email,
            phone,
            designation,
            qualification,
            nid_number: nidNumber || null,
            nid_document_url: nidDocumentUrl,
            previous_employment: previousEmployment || null,
            qualifications,
            is_active: isActive,
          },
        });
        setOpen(false);
      } else {
        const result = await createMutation.mutateAsync({
          full_name: fullName,
          email,
          phone,
          date_of_birth: dateOfBirth,
          employee_code: employeeCode || undefined,
          joining_date: joiningDate,
          designation,
          qualification,
          nid_number: nidNumber || null,
          nid_document_url: nidDocumentUrl,
          previous_employment: previousEmployment || null,
          qualifications,
        });
        setCreated(result);
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
                Teacher added
              </DialogTitle>
              <DialogDescription>
                Share these details with the teacher — the password won&apos;t be shown again. A welcome email with
                these credentials has also been sent.
              </DialogDescription>
            </DialogHeader>

            <div className="print-area flex flex-col gap-2 rounded border border-border p-3 text-sm">
              <p className="hidden pb-2 text-base font-semibold print:block">Teacher registration slip</p>
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
                Password is the teacher&apos;s date of birth (DDMMYYYY). They should change it after first login.
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
              <DialogTitle>{isEdit ? "Edit teacher" : "Add teacher"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Update this teacher's profile."
                  : "Creates a Teacher account and profile. Login password is generated automatically from date of birth."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="t_full_name">Full name</Label>
                <Input id="t_full_name" placeholder="Steve Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t_email">Email</Label>
                  <Input id="t_email" placeholder="steve@mail.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t_phone">Phone</Label>
                  <Input id="t_phone" placeholder="123-456-7890" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
              </div>

              {!isEdit && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t_dob">Date of birth</Label>
                  <Input
                    id="t_dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Used as the teacher&apos;s login password (DDMMYYYY).</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {!isEdit && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="t_employee_code">Employee code</Label>
                    <Input
                      id="t_employee_code"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      placeholder="Auto-generated if blank"
                    />
                  </div>
                )}
                {!isEdit && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="t_joining_date">Joining date</Label>
                    <Input
                      id="t_joining_date"
                      type="date"
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="t_designation">Designation</Label>
                <Select
                  value={designationPreset || undefined}
                  onValueChange={(value) => {
                    setDesignationPreset(value);
                    if (value !== "Other") setDesignationCustom("");
                  }}
                >
                  <SelectTrigger id="t_designation">
                    <SelectValue placeholder="Select designation" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEACHER_DESIGNATIONS.map((option) => (
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="t_qualification">Qualification summary</Label>
                <Textarea
                  id="t_qualification"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  rows={2}
                  placeholder="Optional short summary (e.g. M.Sc in Physics)"
                />
              </div>

              <QualificationsEditor qualifications={qualifications} onChange={setQualifications} />

              <div className="grid grid-cols-2 gap-3 mt-8">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t_nid_number">NID number</Label>
                  <Input id="t_nid_number" placeholder="1234567890" value={nidNumber} onChange={(e) => setNidNumber(e.target.value)} />
                </div>
                <FileUploadField label="NID card upload" value={nidDocumentUrl} onChange={setNidDocumentUrl} />
              </div>

              <div className="flex flex-col gap-1.5 mt-8">
                <Label htmlFor="t_previous_employment">Previous employment (optional)</Label>
                <Textarea
                  id="t_previous_employment"
                  value={previousEmployment}
                  onChange={(e) => setPreviousEmployment(e.target.value)}
                  rows={2}
                  placeholder="Previous employer, designation, and duration"
                />
              </div>

              {isEdit && (
                <div className="flex items-center gap-2">
                  <CheckboxUi
                    id="t_is_active"
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked === true)}
                  />
                  <Label htmlFor="t_is_active">Account active</Label>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isEdit ? "Save changes" : "Add teacher"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
