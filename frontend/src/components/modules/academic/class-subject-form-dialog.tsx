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
import {
  useClassesQuery,
  useCreateClassSubjectMutation,
  useSubjectsQuery,
  useUpdateClassSubjectMutation,
} from "@/hooks/use-academic";
import { useTeachersQuery } from "@/hooks/use-teachers";
import type { ClassSubject } from "@/lib/api/academic";

const NONE = "__none__";

export function ClassSubjectFormDialog({
  trigger,
  academicYearId,
  defaultClassId,
  classSubject,
}: {
  trigger: React.ReactNode;
  academicYearId: string;
  defaultClassId?: string;
  classSubject?: ClassSubject;
}) {
  const isEdit = Boolean(classSubject);
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(classSubject?.class_id ?? defaultClassId ?? "");
  const [subjectId, setSubjectId] = useState(classSubject?.subject_id ?? "");
  const [teacherId, setTeacherId] = useState(classSubject?.teacher_id ?? "");
  const [fullMarks, setFullMarks] = useState(String(classSubject?.full_marks ?? 100));
  const [error, setError] = useState<string | null>(null);

  const classesQuery = useClassesQuery();
  const subjectsQuery = useSubjectsQuery();
  const teachersQuery = useTeachersQuery({ page: 1, limit: 100 });

  const createMutation = useCreateClassSubjectMutation();
  const updateMutation = useUpdateClassSubjectMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && classSubject) {
        await updateMutation.mutateAsync({
          classSubjectId: classSubject.id,
          payload: {
            full_marks: Number(fullMarks),
            teacher_id: teacherId || undefined,
            clear_teacher: !teacherId,
          },
        });
      } else {
        await createMutation.mutateAsync({
          academic_year_id: academicYearId,
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId || null,
          full_marks: Number(fullMarks),
        });
        setSubjectId("");
        setTeacherId("");
        setFullMarks("100");
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
          <DialogTitle>{isEdit ? "Edit subject assignment" : "Assign subject to class"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the assigned teacher or full marks for this subject."
              : "Assigns a subject and teacher to a class for this academic year."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {!defaultClassId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cs_class">Class</Label>
              <Select value={classId || undefined} onValueChange={setClassId} disabled={isEdit}>
                <SelectTrigger id="cs_class">
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
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs_subject">Subject</Label>
            <Select value={subjectId || undefined} onValueChange={setSubjectId} disabled={isEdit}>
              <SelectTrigger id="cs_subject">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {(subjectsQuery.data ?? []).map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs_teacher">Assigned teacher (optional)</Label>
            <Select value={teacherId || NONE} onValueChange={(value) => setTeacherId(value === NONE ? "" : value)}>
              <SelectTrigger id="cs_teacher">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {(teachersQuery.data?.items ?? []).map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs_full_marks">Full marks</Label>
            <Input
              id="cs_full_marks"
              type="number"
              min={1}
              value={fullMarks}
              onChange={(e) => setFullMarks(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !classId || !subjectId}>
              {isEdit ? "Save changes" : "Assign subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
