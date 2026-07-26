"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { emptyQualification, type QualificationInput } from "@/lib/api/qualifications";

export function QualificationsEditor({
  qualifications,
  onChange,
}: {
  qualifications: QualificationInput[];
  onChange: (qualifications: QualificationInput[]) => void;
}) {
  function updateEntry(index: number, patch: Partial<QualificationInput>) {
    onChange(qualifications.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function removeEntry(index: number) {
    onChange(qualifications.filter((_, i) => i !== index));
  }

  function addEntry() {
    onChange([...qualifications, emptyQualification()]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Qualifications</Label>
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          <Plus className="size-4" aria-hidden="true" />
          Add qualification
        </Button>
      </div>

      {qualifications.length === 0 && (
        <p className="text-xs text-muted-foreground">No qualifications added yet.</p>
      )}

      {qualifications.map((entry, index) => (
        <div key={index} className="flex flex-col gap-3 rounded border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Qualification {index + 1}</span>
            <button
              type="button"
              onClick={() => removeEntry(index)}
              aria-label="Remove qualification"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`edu_title_${index}`}>Education title</Label>
              <Input
                id={`edu_title_${index}`}
                value={entry.education_title}
                onChange={(e) => updateEntry(index, { education_title: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`institute_${index}`}>Institute</Label>
              <Input
                id={`institute_${index}`}
                value={entry.institute}
                onChange={(e) => updateEntry(index, { institute: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`grade_${index}`}>Grade</Label>
              <Input
                id={`grade_${index}`}
                value={entry.grade ?? ""}
                onChange={(e) => updateEntry(index, { grade: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`passing_year_${index}`}>Passing year</Label>
              <Input
                id={`passing_year_${index}`}
                type="number"
                value={entry.passing_year ?? ""}
                onChange={(e) => updateEntry(index, { passing_year: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`additional_info_${index}`}>Additional information</Label>
            <Textarea
              id={`additional_info_${index}`}
              value={entry.additional_info ?? ""}
              onChange={(e) => updateEntry(index, { additional_info: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FileUploadField
              label="Certificate"
              value={entry.certificate_url}
              onChange={(url) => updateEntry(index, { certificate_url: url })}
            />
            <FileUploadField
              label="Marksheet"
              value={entry.marksheet_url}
              onChange={(url) => updateEntry(index, { marksheet_url: url })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
