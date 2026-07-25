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
import { useCreateTeacherMutation, useUpdateTeacherMutation } from "@/hooks/use-teachers";
import { loginErrorMessage } from "@/hooks/use-auth";
import type { Teacher } from "@/lib/api/teachers";

export function TeacherFormDialog({ trigger, teacher }: { trigger: React.ReactNode; teacher?: Teacher }) {
  const isEdit = Boolean(teacher);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(teacher?.full_name ?? "");
  const [email, setEmail] = useState(teacher?.email ?? "");
  const [phone, setPhone] = useState(teacher?.phone ?? "");
  const [password, setPassword] = useState("");
  const [employeeCode, setEmployeeCode] = useState(teacher?.employee_code ?? "");
  const [joiningDate, setJoiningDate] = useState(teacher?.joining_date ?? "");
  const [designation, setDesignation] = useState(teacher?.designation ?? "");
  const [qualification, setQualification] = useState(teacher?.qualification ?? "");
  const [isActive, setIsActive] = useState(teacher?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTeacherMutation();
  const updateMutation = useUpdateTeacherMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && teacher) {
        await updateMutation.mutateAsync({
          teacherId: teacher.id,
          payload: { full_name: fullName, email, phone, designation, qualification, is_active: isActive },
        });
      } else {
        await createMutation.mutateAsync({
          full_name: fullName,
          email,
          phone,
          password,
          employee_code: employeeCode || undefined,
          joining_date: joiningDate,
          designation,
          qualification,
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
          <DialogTitle>{isEdit ? "Edit teacher" : "Add teacher"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this teacher's profile." : "Creates a Teacher account and profile."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t_full_name">Full name</Label>
            <Input id="t_full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t_email">Email</Label>
              <Input id="t_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t_phone">Phone</Label>
              <Input id="t_phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t_password">Temporary password</Label>
              <Input
                id="t_password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
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
            <Input id="t_designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t_qualification">Qualification</Label>
            <Textarea
              id="t_qualification"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              rows={2}
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
      </DialogContent>
    </Dialog>
  );
}
