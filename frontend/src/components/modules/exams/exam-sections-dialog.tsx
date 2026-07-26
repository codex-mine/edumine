"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
import { EXAM_SECTION_NAME_PRESETS, type ExamSubjectSectionInput } from "@/lib/api/exams";

interface DraftSection extends ExamSubjectSectionInput {
  isCustomName: boolean;
}

function toDraft(sections: ExamSubjectSectionInput[]): DraftSection[] {
  return sections.map((section) => ({
    ...section,
    isCustomName: section.name !== "" && !(EXAM_SECTION_NAME_PRESETS as readonly string[]).includes(section.name),
  }));
}

export function ExamSectionsDialog({
  trigger,
  sections,
  fullMarks,
  onChange,
}: {
  trigger: React.ReactNode;
  sections: ExamSubjectSectionInput[];
  fullMarks: number;
  onChange: (sections: ExamSubjectSectionInput[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftSection[]>(() => toDraft(sections));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setDraft(toDraft(sections));
  }

  function updateEntry(index: number, patch: Partial<DraftSection>) {
    setDraft((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function removeEntry(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function addEntry() {
    setDraft((prev) => [...prev, { name: "", full_marks: 0, pass_marks: 0, isCustomName: false }]);
  }

  const total = draft.reduce((sum, s) => sum + (Number(s.full_marks) || 0), 0);
  const isBalanced = draft.length === 0 || total === fullMarks;
  const hasEmptyNames = draft.some((s) => !s.name);

  function handleSave() {
    onChange(draft.map((entry) => ({ name: entry.name, full_marks: entry.full_marks, pass_marks: entry.pass_marks })));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure sections</DialogTitle>
          <DialogDescription>
            Optional marks breakdown (CQ, MCQ, Practical, Lab, or custom). Leave empty to grade this subject as a
            single block.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {draft.map((entry, index) => (
            <div key={index} className="flex flex-col gap-2 rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Section {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeEntry(index)}
                  aria-label="Remove section"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`section_name_${index}`}>Name</Label>
                <Select
                  value={entry.isCustomName ? "Other" : entry.name || undefined}
                  onValueChange={(value) => {
                    if (value === "Other") {
                      updateEntry(index, { isCustomName: true, name: "" });
                    } else {
                      updateEntry(index, { isCustomName: false, name: value });
                    }
                  }}
                >
                  <SelectTrigger id={`section_name_${index}`}>
                    <SelectValue placeholder="Select section type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_SECTION_NAME_PRESETS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {entry.isCustomName && (
                  <Input
                    value={entry.name}
                    onChange={(e) => updateEntry(index, { name: e.target.value })}
                    placeholder="Specify section name"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`section_full_${index}`}>Total marks</Label>
                  <Input
                    id={`section_full_${index}`}
                    type="number"
                    min={1}
                    value={entry.full_marks}
                    onChange={(e) => updateEntry(index, { full_marks: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`section_pass_${index}`}>Pass marks</Label>
                  <Input
                    id={`section_pass_${index}`}
                    type="number"
                    min={0}
                    value={entry.pass_marks}
                    onChange={(e) => updateEntry(index, { pass_marks: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addEntry} className="w-fit">
            <Plus className="size-4" aria-hidden="true" />
            Add section
          </Button>

          <p className={`text-xs ${isBalanced ? "text-muted-foreground" : "text-destructive"}`}>
            {draft.length === 0
              ? `No sections — subject graded as a single ${fullMarks}-mark block.`
              : `Sections total: ${total} / ${fullMarks}${isBalanced ? "" : " — must match full marks exactly"}`}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isBalanced || hasEmptyNames}>
            Save sections
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
