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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useClassesQuery, useCreateSectionMutation, useRoomsQuery, useUpdateSectionMutation } from "@/hooks/use-academic";
import { useTeachersQuery } from "@/hooks/use-teachers";
import type { Section } from "@/lib/api/academic";

const NONE = "__none__";

export function SectionFormDialog({
  trigger,
  academicYearId,
  section,
}: {
  trigger: React.ReactNode;
  academicYearId: string;
  section?: Section;
}) {
  const isEdit = Boolean(section);
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(section?.class_id ?? "");
  const [roomId, setRoomId] = useState(section?.room_id ?? "");
  const [name, setName] = useState(section?.name ?? "");
  const [capacity, setCapacity] = useState(section?.capacity != null ? String(section.capacity) : "");
  const [classTeacherId, setClassTeacherId] = useState(section?.class_teacher_id ?? "");
  const [error, setError] = useState<string | null>(null);

  const classesQuery = useClassesQuery();
  const roomsQuery = useRoomsQuery();
  const teachersQuery = useTeachersQuery({ page: 1, limit: 100 });

  const createMutation = useCreateSectionMutation();
  const updateMutation = useUpdateSectionMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && section) {
        await updateMutation.mutateAsync({
          sectionId: section.id,
          payload: {
            name,
            capacity: capacity ? Number(capacity) : null,
            room_id: roomId || undefined,
            clear_room: !roomId,
            class_teacher_id: classTeacherId || undefined,
            clear_class_teacher: !classTeacherId,
          },
        });
      } else {
        await createMutation.mutateAsync({
          academic_year_id: academicYearId,
          class_id: classId,
          room_id: roomId || null,
          name,
          capacity: capacity ? Number(capacity) : null,
          class_teacher_id: classTeacherId || null,
        });
        setClassId("");
        setRoomId("");
        setName("");
        setCapacity("");
        setClassTeacherId("");
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
          <DialogTitle>{isEdit ? "Edit section" : "Add section"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this section." : "Sections are scoped to a single academic year."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sec_class">Class</Label>
            <Select value={classId || undefined} onValueChange={setClassId} disabled={isEdit}>
              <SelectTrigger id="sec_class">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sec_name">Section name</Label>
              <Input id="sec_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. A" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sec_capacity">Capacity (optional)</Label>
              <Input
                id="sec_capacity"
                type="number"
                placeholder="50"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sec_room">Home room (optional)</Label>
            <Select value={roomId || NONE} onValueChange={(value) => setRoomId(value === NONE ? "" : value)}>
              <SelectTrigger id="sec_room">
                <SelectValue placeholder="No room assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No room</SelectItem>
                {(roomsQuery.data ?? []).map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sec_teacher">Class teacher (optional)</Label>
            <Select
              value={classTeacherId || NONE}
              onValueChange={(value) => setClassTeacherId(value === NONE ? "" : value)}
            >
              <SelectTrigger id="sec_teacher">
                <SelectValue placeholder="No class teacher assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No class teacher</SelectItem>
                {(teachersQuery.data?.items ?? []).map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !classId || !name}>
              {isEdit ? "Save changes" : "Add section"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
