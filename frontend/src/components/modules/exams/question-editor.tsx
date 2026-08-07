"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExamSubjectSection, QuestionItem, QuestionType } from "@/lib/api/exams";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple choice" },
  { value: "short", label: "Short answer" },
  { value: "long", label: "Long answer" },
];

const NO_SECTION = "__none__";

function emptyQuestion(): QuestionItem {
  return { question_text: "", marks: 1, type: "short", options: null };
}

export function QuestionEditor({
  questions,
  onChange,
  fullMarks,
  sections = [],
}: {
  questions: QuestionItem[];
  onChange: (questions: QuestionItem[]) => void;
  fullMarks: number;
  /** Configured CQ/MCQ/Practical breakdown. When present each question can be
   * filed under one, and every used section must hit its own marks total. */
  sections?: ExamSubjectSection[];
}) {
  const totalMarks = questions.reduce((sum, q) => sum + (Number.isFinite(q.marks) ? q.marks : 0), 0);

  const sectionTotals = sections.map((section) => ({
    ...section,
    used: questions
      .filter((q) => q.section === section.name)
      .reduce((sum, q) => sum + (Number.isFinite(q.marks) ? q.marks : 0), 0),
  }));

  function updateQuestion(index: number, patch: Partial<QuestionItem>) {
    const next = questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    onChange(next);
  }

  function updateOption(index: number, optionIndex: number, value: string) {
    const question = questions[index];
    const options = [...(question.options ?? [])];
    options[optionIndex] = value;
    updateQuestion(index, { options });
  }

  function addOption(index: number) {
    const question = questions[index];
    updateQuestion(index, { options: [...(question.options ?? []), ""] });
  }

  function removeOption(index: number, optionIndex: number) {
    const question = questions[index];
    updateQuestion(index, { options: (question.options ?? []).filter((_, i) => i !== optionIndex) });
  }

  function addQuestion() {
    onChange([...questions, emptyQuestion()]);
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.map((question, index) => (
        <div key={index} className="flex flex-col gap-3 rounded border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-foreground">Question {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeQuestion(index)}
              aria-label="Remove question"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`q_text_${index}`}>Question text</Label>
            <Textarea
              id={`q_text_${index}`}
              value={question.question_text}
              onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
              placeholder="Enter the question"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`q_type_${index}`}>Type</Label>
              <Select
                value={question.type}
                onValueChange={(value) =>
                  updateQuestion(index, {
                    type: value as QuestionType,
                    options: value === "mcq" ? question.options ?? ["", ""] : null,
                  })
                }
              >
                <SelectTrigger id={`q_type_${index}`} className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`q_marks_${index}`}>Marks</Label>
              <Input
                id={`q_marks_${index}`}
                type="number"
                min={1}
                className="w-24"
                value={question.marks}
                onChange={(e) => updateQuestion(index, { marks: Number(e.target.value) || 0 })}
              />
            </div>
            {sections.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`q_section_${index}`}>Section</Label>
                <Select
                  value={question.section ?? NO_SECTION}
                  onValueChange={(value) =>
                    updateQuestion(index, { section: value === NO_SECTION ? null : value })
                  }
                >
                  <SelectTrigger id={`q_section_${index}`} className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SECTION}>Ungrouped</SelectItem>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.name}>
                        {section.name} ({section.full_marks})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {question.type === "mcq" && (
            <div className="flex flex-col gap-2">
              <Label>Options</Label>
              {(question.options ?? []).map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                    placeholder={`Option ${optionIndex + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index, optionIndex)}
                    aria-label="Remove option"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addOption(index)} className="w-fit">
                <Plus className="size-4" /> Add option
              </Button>
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addQuestion} className="w-fit">
        <Plus className="size-4" /> Add question
      </Button>

      <p className={`text-sm ${totalMarks === fullMarks ? "text-success" : "text-destructive"}`}>
        Total marks: {totalMarks} / {fullMarks}
        {totalMarks !== fullMarks && " — must sum exactly to the full marks before submitting"}
      </p>

      {sectionTotals.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {sectionTotals.map((section) => {
            // A section left entirely empty is allowed; one that is used at all
            // has to be filled exactly, matching the server-side rule.
            const untouched = section.used === 0;
            const balanced = section.used === section.full_marks;
            return (
              <span
                key={section.id}
                className={
                  untouched ? "text-muted-foreground" : balanced ? "text-success" : "text-destructive"
                }
              >
                {section.name}: {section.used} / {section.full_marks}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
