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
import { useEnrollStudentMutation, useSectionsQuery } from "@/hooks/use-academic";
import { useStudentsQuery } from "@/hooks/use-students";
import { formatSectionOccupancy, isSectionFull } from "@/lib/api/academic";

export function EnrollStudentDialog({
  trigger,
  academicYearId,
}: {
  trigger: React.ReactNode;
  academicYearId: string;
}) {
  const [open, setOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const studentsQuery = useStudentsQuery({ page: 1, limit: 10, search: studentSearch || undefined });
  const sectionsQuery = useSectionsQuery({ academic_year_id: academicYearId });
  const enrollMutation = useEnrollStudentMutation();

  const selectedStudent = (studentsQuery.data?.items ?? []).find((s) => s.id === selectedStudentId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selectedStudentId) {
      setError("Select a student first");
      return;
    }
    try {
      await enrollMutation.mutateAsync({
        student_id: selectedStudentId,
        academic_year_id: academicYearId,
        section_id: sectionId,
        roll_number: rollNumber || null,
      });
      setStudentSearch("");
      setSelectedStudentId(null);
      setSectionId("");
      setRollNumber("");
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
          <DialogTitle>Enroll student</DialogTitle>
          <DialogDescription>Place a student into a section for this academic year.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enroll_student_search">Student</Label>
            <Input
              id="enroll_student_search"
              placeholder="Search by name, email, or admission number"
              value={selectedStudent ? selectedStudent.full_name : studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setSelectedStudentId(null);
              }}
            />
            {studentSearch && !selectedStudentId && (
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded border border-border p-1">
                {(studentsQuery.data?.items ?? []).length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No matching students.</p>
                ) : (
                  (studentsQuery.data?.items ?? []).map((candidate) => (
                    <button
                      type="button"
                      key={candidate.id}
                      onClick={() => setSelectedStudentId(candidate.id)}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span>{candidate.full_name}</span>
                      <span className="text-xs text-muted-foreground">{candidate.admission_number}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enroll_section">Section</Label>
            <Select value={sectionId || undefined} onValueChange={setSectionId}>
              <SelectTrigger id="enroll_section">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {(sectionsQuery.data ?? []).map((section) => (
                  <SelectItem key={section.id} value={section.id} disabled={isSectionFull(section)}>
                    {section.class_name} - {section.name} ({formatSectionOccupancy(section)})
                    {isSectionFull(section) ? " · full" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enroll_roll">Roll number (optional)</Label>
            <Input
              id="enroll_roll"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="Auto-assigned if left blank"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={enrollMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={enrollMutation.isPending || !selectedStudentId || !sectionId}>
              Enroll student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
