"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";

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
import { useCreateStudentMutation, useUpdateStudentMutation } from "@/hooks/use-students";
import { useActiveAcademicYearQuery, useClassesQuery, useSectionsQuery } from "@/hooks/use-academic";
import { loginErrorMessage } from "@/hooks/use-auth";
import { formatSectionOccupancy, isSectionFull } from "@/lib/api/academic";
import type { AdmitStudentResult, Student } from "@/lib/api/students";

export function StudentFormDialog({ trigger, student }: { trigger: React.ReactNode; student?: Student }) {
  const isEdit = Boolean(student);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(student?.full_name ?? "");
  const [email, setEmail] = useState(student?.email ?? "");
  const [phone, setPhone] = useState(student?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(student?.date_of_birth ?? "");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [bloodGroup, setBloodGroup] = useState(student?.blood_group ?? "");
  const [address, setAddress] = useState(student?.address ?? "");
  const [emergencyContact, setEmergencyContact] = useState(student?.emergency_contact ?? "");
  const [isActive, setIsActive] = useState(student?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [admitted, setAdmitted] = useState<AdmitStudentResult | null>(null);

  const activeYearQuery = useActiveAcademicYearQuery();
  const classesQuery = useClassesQuery();
  const sectionsQuery = useSectionsQuery({ academic_year_id: activeYearQuery.data?.id, class_id: classId || undefined });

  const createMutation = useCreateStudentMutation();
  const updateMutation = useUpdateStudentMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  function resetCreateFields() {
    setFullName("");
    setEmail("");
    setPhone("");
    setDateOfBirth("");
    setClassId("");
    setSectionId("");
    setAdmissionDate("");
    setBloodGroup("");
    setAddress("");
    setEmergencyContact("");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setAdmitted(null);
      setError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && student) {
        await updateMutation.mutateAsync({
          studentId: student.id,
          payload: {
            full_name: fullName,
            email: email || undefined,
            phone,
            blood_group: bloodGroup,
            address,
            emergency_contact: emergencyContact,
            is_active: isActive,
          },
        });
        setOpen(false);
      } else {
        const result = await createMutation.mutateAsync({
          full_name: fullName,
          email: email || null,
          phone,
          date_of_birth: dateOfBirth,
          section_id: sectionId,
          admission_date: admissionDate || null,
          blood_group: bloodGroup || null,
          address: address || null,
          emergency_contact: emergencyContact || null,
        });
        resetCreateFields();
        setAdmitted(result);
      }
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  const selectedSection = (sectionsQuery.data ?? []).find((s) => s.id === sectionId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {admitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PartyPopper className="size-5 text-primary" aria-hidden="true" />
                Student admitted
              </DialogTitle>
              <DialogDescription>
                Share these details with the student — the password won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2 rounded border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground">{admitted.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Admission #</span>
                <span className="font-medium text-foreground">{admitted.admission_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Class / Section</span>
                <span className="font-medium text-foreground">
                  {admitted.class_name} - {admitted.section_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Roll number</span>
                <span className="font-medium text-foreground">{admitted.roll_number}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Login phone</span>
                <span className="font-medium text-foreground">{admitted.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Temporary password</span>
                <span className="font-mono font-medium text-foreground">{admitted.temporary_password}</span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Password is the student&apos;s date of birth (DDMMYYYY). They should change it after first login.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit student" : "Admit student"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Update this student's profile."
                  : "Creates a Student account and admission record. Admission number, roll number, and login password are generated automatically."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s_full_name">Full name</Label>
                <Input id="s_full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s_email">Email (optional)</Label>
                  <Input id="s_email" type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s_phone">Phone</Label>
                  <Input id="s_phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
              </div>

              {!isEdit && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s_dob">Date of birth</Label>
                  <Input
                    id="s_dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Used as the student&apos;s login password (DDMMYYYY).
                  </p>
                </div>
              )}

              {!isEdit && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="s_class">Class</Label>
                    <Select
                      value={classId || undefined}
                      onValueChange={(value) => {
                        setClassId(value);
                        setSectionId("");
                      }}
                    >
                      <SelectTrigger id="s_class">
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {(classesQuery.data ?? []).map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="s_section">Section</Label>
                    <Select value={sectionId || undefined} onValueChange={setSectionId} disabled={!classId}>
                      <SelectTrigger id="s_section">
                        <SelectValue placeholder={classId ? "Select a section" : "Select a class first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(sectionsQuery.data ?? []).map((section) => (
                          <SelectItem key={section.id} value={section.id} disabled={isSectionFull(section)}>
                            {section.name} ({formatSectionOccupancy(section)})
                            {isSectionFull(section) ? " · full" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {!isEdit && !activeYearQuery.data && !activeYearQuery.isLoading && (
                <p className="text-sm text-destructive">
                  No active academic year — set one up under Academic &rarr; Years first.
                </p>
              )}
              {!isEdit && selectedSection && (
                <p className="text-xs text-muted-foreground">
                  Next roll number in this section will be assigned automatically.
                </p>
              )}

              {!isEdit && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s_admission_date">Admission date (optional)</Label>
                  <Input
                    id="s_admission_date"
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    placeholder="Defaults to today"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s_blood_group">Blood group</Label>
                  <Input
                    id="s_blood_group"
                    value={bloodGroup ?? ""}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    placeholder="e.g. O+"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s_emergency_contact">Emergency contact</Label>
                  <Input
                    id="s_emergency_contact"
                    value={emergencyContact ?? ""}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s_address">Address</Label>
                <Textarea id="s_address" value={address ?? ""} onChange={(e) => setAddress(e.target.value)} rows={2} />
              </div>

              {isEdit && (
                <div className="flex items-center gap-2">
                  <CheckboxUi
                    id="s_is_active"
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked === true)}
                  />
                  <Label htmlFor="s_is_active">Account active</Label>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || (!isEdit && !sectionId)}>
                  {isEdit ? "Save changes" : "Admit student"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
