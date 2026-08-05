"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import { useCreateRoomMutation, useUpdateRoomMutation } from "@/hooks/use-academic";
import type { Room } from "@/lib/api/academic";

export function RoomFormDialog({ trigger, room }: { trigger: React.ReactNode; room?: Room }) {
  const isEdit = Boolean(room);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(room?.name ?? "");
  const [capacity, setCapacity] = useState(room?.capacity != null ? String(room.capacity) : "");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateRoomMutation();
  const updateMutation = useUpdateRoomMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const payload = { name, capacity: capacity ? Number(capacity) : null };
      if (isEdit && room) {
        await updateMutation.mutateAsync({ roomId: room.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
        setName("");
        setCapacity("");
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
          <DialogTitle>{isEdit ? "Edit room" : "Add room"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this room." : "Rooms are reusable master records shared across academic years."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r_name">Name</Label>
            <Input id="r_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 101" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r_capacity">Capacity (optional)</Label>
            <Input id="r_capacity" placeholder="50" type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Save changes" : "Add room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
