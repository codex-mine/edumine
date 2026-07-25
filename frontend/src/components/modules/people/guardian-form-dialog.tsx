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
import { useCreateGuardianMutation, useUpdateGuardianMutation } from "@/hooks/use-guardians";
import { loginErrorMessage } from "@/hooks/use-auth";
import type { Guardian } from "@/lib/api/guardians";

export function GuardianFormDialog({ trigger, guardian }: { trigger: React.ReactNode; guardian?: Guardian }) {
  const isEdit = Boolean(guardian);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(guardian?.full_name ?? "");
  const [email, setEmail] = useState(guardian?.email ?? "");
  const [phone, setPhone] = useState(guardian?.phone ?? "");
  const [password, setPassword] = useState("");
  const [occupation, setOccupation] = useState(guardian?.occupation ?? "");
  const [address, setAddress] = useState(guardian?.address ?? "");
  const [isActive, setIsActive] = useState(guardian?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateGuardianMutation();
  const updateMutation = useUpdateGuardianMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && guardian) {
        await updateMutation.mutateAsync({
          guardianId: guardian.id,
          payload: { full_name: fullName, email, phone, occupation, address, is_active: isActive },
        });
      } else {
        await createMutation.mutateAsync({ full_name: fullName, email, phone, password, occupation, address });
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
          <DialogTitle>{isEdit ? "Edit guardian" : "Add guardian"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this guardian's profile." : "Creates a Guardian account and profile."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g_full_name">Full name</Label>
            <Input id="g_full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g_email">Email</Label>
              <Input id="g_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g_phone">Phone</Label>
              <Input id="g_phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g_password">Temporary password</Label>
              <Input
                id="g_password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g_occupation">Occupation</Label>
            <Input id="g_occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g_address">Address</Label>
            <Textarea id="g_address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <CheckboxUi
                id="g_is_active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label htmlFor="g_is_active">Account active</Label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Save changes" : "Add guardian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
