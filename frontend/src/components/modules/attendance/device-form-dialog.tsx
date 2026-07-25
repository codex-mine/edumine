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
import { loginErrorMessage } from "@/hooks/use-auth";
import { useCreateDeviceMutation, useUpdateDeviceMutation } from "@/hooks/use-attendance";
import type { BiometricDevice } from "@/lib/api/attendance";

export function DeviceFormDialog({ trigger, device }: { trigger: React.ReactNode; device?: BiometricDevice }) {
  const isEdit = Boolean(device);
  const [open, setOpen] = useState(false);
  const [deviceSerial, setDeviceSerial] = useState(device?.device_serial ?? "");
  const [location, setLocation] = useState(device?.location ?? "");
  const [isActive, setIsActive] = useState(device?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateDeviceMutation();
  const updateMutation = useUpdateDeviceMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && device) {
        await updateMutation.mutateAsync({
          deviceId: device.id,
          payload: { location: location || null, is_active: isActive },
        });
      } else {
        await createMutation.mutateAsync({ device_serial: deviceSerial, location: location || null });
        setDeviceSerial("");
        setLocation("");
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
          <DialogTitle>{isEdit ? "Edit device" : "Register biometric device"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this device's location or enable/disable it."
              : "Register an F18 fingerprint device before it can submit punch events."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dev_serial">Device serial</Label>
            <Input
              id="dev_serial"
              value={deviceSerial}
              onChange={(e) => setDeviceSerial(e.target.value)}
              placeholder="e.g. F18-MAIN-GATE"
              disabled={isEdit}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dev_location">Location (optional)</Label>
            <Input
              id="dev_location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Gate"
            />
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <CheckboxUi checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
              Device is active
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !deviceSerial}>
              {isEdit ? "Save changes" : "Register device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
