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
import { useClassSubjectsQuery, useRoomsQuery } from "@/hooks/use-academic";
import { useTeachersQuery } from "@/hooks/use-teachers";
import { useCreateRoutineSlotMutation, useUpdateRoutineSlotMutation } from "@/hooks/use-routine";
import { WEEKDAYS, WEEKDAY_LABELS, type RoutineSlot, type Weekday } from "@/lib/api/routine";

const NONE = "__none__";

export function RoutineSlotFormDialog({
  trigger,
  academicYearId,
  sectionId,
  classId,
  slot,
  defaultDay,
  defaultPeriod,
}: {
  trigger: React.ReactNode;
  academicYearId: string;
  sectionId: string;
  classId: string;
  slot?: RoutineSlot;
  defaultDay?: Weekday;
  defaultPeriod?: number;
}) {
  const isEdit = Boolean(slot);
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(slot?.subject_id ?? "");
  const [teacherId, setTeacherId] = useState(slot?.teacher_id ?? "");
  const [roomId, setRoomId] = useState(slot?.room_id ?? "");
  const [dayOfWeek, setDayOfWeek] = useState<Weekday>(slot?.day_of_week ?? defaultDay ?? "monday");
  const [periodNumber, setPeriodNumber] = useState(String(slot?.period_number ?? defaultPeriod ?? 1));
  const [startTime, setStartTime] = useState(slot?.start_time.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(slot?.end_time.slice(0, 5) ?? "");
  const [error, setError] = useState<string | null>(null);

  const classSubjectsQuery = useClassSubjectsQuery({ academic_year_id: academicYearId, class_id: classId });
  const teachersQuery = useTeachersQuery({ page: 1, limit: 200 });
  const roomsQuery = useRoomsQuery();

  const createMutation = useCreateRoutineSlotMutation();
  const updateMutation = useUpdateRoutineSlotMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  function resetForNextEntry() {
    setSubjectId("");
    setTeacherId("");
    setRoomId("");
    setStartTime("");
    setEndTime("");
  }

  function handleSubjectChange(value: string) {
    setSubjectId(value);
    const match = (classSubjectsQuery.data ?? []).find((cs) => cs.subject_id === value);
    if (match?.teacher_id) setTeacherId(match.teacher_id);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && slot) {
        await updateMutation.mutateAsync({
          slotId: slot.id,
          payload: {
            subject_id: subjectId,
            teacher_id: teacherId,
            room_id: roomId || undefined,
            clear_room: !roomId,
            day_of_week: dayOfWeek,
            period_number: Number(periodNumber),
            start_time: `${startTime}:00`,
            end_time: `${endTime}:00`,
          },
        });
      } else {
        await createMutation.mutateAsync({
          academic_year_id: academicYearId,
          section_id: sectionId,
          subject_id: subjectId,
          teacher_id: teacherId,
          room_id: roomId || null,
          day_of_week: dayOfWeek,
          period_number: Number(periodNumber),
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
        });
        resetForNextEntry();
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
          <DialogTitle>{isEdit ? "Edit routine slot" : "Add routine slot"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the subject, teacher, or room for this period."
              : "Schedule a subject and teacher for this section's period. A teacher already booked elsewhere at this day and period will be rejected."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs_day">Day</Label>
              <Select value={dayOfWeek} onValueChange={(value) => setDayOfWeek(value as Weekday)}>
                <SelectTrigger id="rs_day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {WEEKDAY_LABELS[day]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs_period">Period</Label>
              <Input
                id="rs_period"
                type="number"
                min={1}
                value={periodNumber}
                onChange={(e) => setPeriodNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rs_subject">Subject</Label>
            <Select value={subjectId || undefined} onValueChange={handleSubjectChange}>
              <SelectTrigger id="rs_subject">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {(classSubjectsQuery.data ?? []).map((cs) => (
                  <SelectItem key={cs.subject_id} value={cs.subject_id}>
                    {cs.subject_name} ({cs.subject_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(classSubjectsQuery.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                No subjects are assigned to this class yet — assign one from Sections &amp; Assignment first.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rs_teacher">Teacher</Label>
            <Select value={teacherId || undefined} onValueChange={setTeacherId}>
              <SelectTrigger id="rs_teacher">
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                {(teachersQuery.data?.items ?? []).map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rs_room">Room (optional)</Label>
            <Select value={roomId || NONE} onValueChange={(value) => setRoomId(value === NONE ? "" : value)}>
              <SelectTrigger id="rs_room">
                <SelectValue placeholder="Use section's home room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Use section&apos;s home room</SelectItem>
                {(roomsQuery.data ?? []).map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs_start">Start time</Label>
              <Input id="rs_start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs_end">End time</Label>
              <Input id="rs_end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !subjectId || !teacherId || !startTime || !endTime}>
              {isEdit ? "Save changes" : "Add slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
