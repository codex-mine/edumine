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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateUserAccountMutation, useUpdateUserAccountMutation } from "@/hooks/use-users";
import { loginErrorMessage } from "@/hooks/use-auth";
import type { UserAccount, UserAccountRole } from "@/lib/api/users";
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
  const [department, setDepartment] = useState(account?.department ?? "");
  const [designation, setDesignation] = useState(account?.designation ?? "");
  const [joiningDate, setJoiningDate] = useState(account?.joining_date ?? "");
  const [isActive, setIsActive] = useState(account?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateUserAccountMutation();
  const updateMutation = useUpdateUserAccountMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const isStaffLike = STAFF_LIKE.includes(role);

  const roleOptions: UserAccountRole[] =
    currentUserRole === "principal" ? ["admin", "staff", "accountant", "receptionist"] : STAFF_LIKE;

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
            ...(account.role !== "admin" ? { department, designation } : {}),
          },
        });
      } else {
        await createMutation.mutateAsync({
          role,
          full_name: fullName,
          email,
          phone,
          password,
          ...(isStaffLike ? { department, designation, joining_date: joiningDate } : {}),
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

          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Temporary password</Label>
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

          {(isEdit ? account?.role !== "admin" : isStaffLike) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="department">Department</Label>
                <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
              </div>
            </div>
          )}

          {!isEdit && isStaffLike && (
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
      </DialogContent>
    </Dialog>
  );
}
