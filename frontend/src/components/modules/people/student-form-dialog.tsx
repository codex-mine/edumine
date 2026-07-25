"use client";

import { useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { useCreateStudentMutation, useUpdateStudentMutation } from "@/hooks/use-students";
import { loginErrorMessage } from "@/hooks/use-auth";
import type { Student } from "@/lib/api/students";

export function StudentFormDialog({ trigger, student }: { trigger: React.ReactNode; student?: Student }) {
  const isEdit = Boolean(student);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(student?.full_name ?? "");
  const [email, setEmail] = useState(student?.email ?? "");
  const [phone, setPhone] = useState(student?.phone ?? "");
  const [password, setPassword] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState(student?.admission_number ?? "");
  const [admissionDate, setAdmissionDate] = useState(student?.admission_date ?? "");
  const [bloodGroup, setBloodGroup] = useState(student?.blood_group ?? "");
  const [address, setAddress] = useState(student?.address ?? "");
  const [emergencyContact, setEmergencyContact] = useState(student?.emergency_contact ?? "");
  const [isActive, setIsActive] = useState(student?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateStudentMutation();
  const updateMutation = useUpdateStudentMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

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
      } else {
        await createMutation.mutateAsync({
          full_name: fullName,
          email: email || null,
          phone,
          password,
          admission_number: admissionNumber || null,
          admission_date: admissionDate || null,
          blood_group: bloodGroup || null,
          address: address || null,
          emergency_contact: emergencyContact || null,
        });
      }
      setOpen(false);
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit student" : "Admit student"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this student's profile." : "Creates a Student account and admission record."}
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
              <Label htmlFor="s_password">Temporary password</Label>
              <Input
                id="s_password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          )}

          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s_admission_number">Admission number</Label>
                <Input
                  id="s_admission_number"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                  placeholder="Auto-generated if blank"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s_admission_date">Admission date</Label>
                <Input
                  id="s_admission_date"
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                />
              </div>
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
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Save changes" : "Admit student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
