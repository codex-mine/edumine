"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { QuestionReviewDialog } from "@/components/modules/exams/question-review-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useQuestionsForReviewQuery } from "@/hooks/use-exams";
import {
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_VARIANT,
  type ExamSubject,
  type QuestionApprovalStatus,
} from "@/lib/api/exams";

const TABS: { value: QuestionApprovalStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "revision_requested", label: "Revision requested" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Not submitted" },
  { value: "all", label: "All" },
];

export default function AdminQuestionReviewPage() {
  const [tab, setTab] = useState<QuestionApprovalStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ExamSubject | null>(null);

  const query = useQuestionsForReviewQuery(tab === "all" ? {} : { status: [tab] });

  // The endpoint returns the whole queue for a status rather than a page, so
  // search narrows what is already loaded.
  const needle = search.trim().toLowerCase();
  const visible = (query.data ?? []).filter(
    (item) =>
      !needle ||
      [item.exam_name, item.class_name, item.subject_name, item.teacher_name].some((field) =>
        field.toLowerCase().includes(needle)
      )
  );

  const rows = visible.map((item) => ({
    subject: (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{item.subject_name}</span>
        <span className="text-xs text-muted-foreground">Class {item.class_name}</span>
      </div>
    ),
    exam: item.exam_name,
    teacher: item.teacher_name,
    questions: item.questions?.length ? `${item.questions.length} · ${item.full_marks} marks` : "—",
    submitted: item.question_submitted_at
      ? new Date(item.question_submitted_at).toLocaleDateString()
      : "—",
    status: (
      <Badge variant={QUESTION_STATUS_VARIANT[item.question_status]}>
        {QUESTION_STATUS_LABELS[item.question_status]}
      </Badge>
    ),
    review: (
      <Button variant="ghost" size="sm" onClick={() => setSelected(item)}>
        Review
      </Button>
    ),
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Question review</h1>
        <p className="text-sm text-muted-foreground">
          Approve or send back question papers submitted by teachers — or write them yourself.
        </p>
      </div>

      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded border bg-muted p-1">
        {TABS.map((t) => (
          <Button
            key={t.value}
            variant={tab === t.value ? "default" : "ghost"}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <DataTable
        title="Submitted question papers"
        description="One row per exam subject. Click Review to preview, approve, or request changes."
        icon={<ClipboardCheck className="size-6" aria-hidden="true" />}
        columns={[
          { key: "subject", label: "Subject" },
          { key: "exam", label: "Exam" },
          { key: "teacher", label: "Teacher" },
          { key: "questions", label: "Questions" },
          { key: "submitted", label: "Submitted" },
          { key: "status", label: "Status" },
          { key: "review", label: "" },
        ]}
        rows={rows}
        isLoading={query.isPending}
        isError={query.isError}
        errorMessage={query.error ? loginErrorMessage(query.error) : undefined}
        onRetry={() => query.refetch()}
        emptyMessage={
          search
            ? "No question papers match your search."
            : tab === "pending"
              ? "Nothing is waiting for approval right now."
              : "No question papers in this state."
        }
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by exam, class, subject, or teacher"
        page={1}
        limit={Math.max(rows.length, 1)}
        total={rows.length}
        onPageChange={() => {}}
        onRowClick={(index) => {
          const row = visible[index];
          if (row) setSelected(row);
        }}
      />

      <QuestionReviewDialog
        examSubject={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
