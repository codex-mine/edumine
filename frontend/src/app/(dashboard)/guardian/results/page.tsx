"use client";

import { useState } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ExamCardView } from "@/components/modules/results/exam-card-view";
import { InsightSummaryCard } from "@/components/modules/results/insight-summary-card";
import { ReportCardView } from "@/components/modules/results/report-card-view";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useOwnGuardianProfileQuery } from "@/hooks/use-guardians";
import {
  useStudentExamCardQuery,
  useStudentIndividualInsightMutation,
  useStudentReportCardQuery,
} from "@/hooks/use-results";

export default function GuardianResultsPage() {
  const profileQuery = useOwnGuardianProfileQuery();
  const [studentId, setStudentId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const insightMutation = useStudentIndividualInsightMutation();

  const children = profileQuery.data?.students ?? [];
  const resolvedStudentId = studentId || children[0]?.student_id || "";

  const reportQuery = useStudentReportCardQuery(resolvedStudentId);
  const exams = reportQuery.data?.exams ?? [];
  const resolvedExamId = selectedExamId || exams[0]?.exam_id || "";
  const examCardQuery = useStudentExamCardQuery(resolvedStudentId, resolvedExamId);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Children&apos;s results</h1>
        <p className="text-sm text-muted-foreground">Published exam results and year-end report cards.</p>
      </div>

      {profileQuery.isLoading ? (
        <LoadingState label="Loading your profile..." />
      ) : children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No linked children found</CardTitle>
            <CardDescription>Once a child is linked to your account, their results appear here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
              <CardDescription>Choose a child.</CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-1.5 px-4 pb-4 sm:w-[20rem]">
              <Label htmlFor="gr_child">Child</Label>
              <Select
                value={resolvedStudentId || undefined}
                onValueChange={(value) => {
                  setStudentId(value);
                  setSelectedExamId("");
                }}
              >
                <SelectTrigger id="gr_child" className="w-full">
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.student_id} value={child.student_id}>
                      {child.full_name} ({child.admission_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {reportQuery.isLoading ? (
            <LoadingState label="Loading results..." />
          ) : reportQuery.isError ? (
            <ErrorState message={loginErrorMessage(reportQuery.error)} onRetry={() => reportQuery.refetch()} />
          ) : exams.length === 0 ? (
            <EmptyState message="No results have been published for this child yet." />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Exam result card</CardTitle>
                  <CardDescription>Choose a published exam to view its full result card.</CardDescription>
                </CardHeader>
                <div className="px-4 pb-4">
                  <Select value={resolvedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger className="w-full sm:w-[20rem]">
                      <SelectValue placeholder="Select an exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map((exam) => (
                        <SelectItem key={exam.exam_id} value={exam.exam_id}>
                          {exam.exam_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              {examCardQuery.isLoading ? (
                <LoadingState label="Loading exam card..." />
              ) : examCardQuery.isError ? (
                <ErrorState message={loginErrorMessage(examCardQuery.error)} onRetry={() => examCardQuery.refetch()} />
              ) : examCardQuery.data ? (
                <>
                  <ExamCardView card={examCardQuery.data} />
                  <InsightSummaryCard
                    title="Insight summary"
                    description="A plain-language summary of your child's results for this exam."
                    onGenerate={() =>
                      insightMutation.mutateAsync({ studentId: resolvedStudentId, examId: resolvedExamId })
                    }
                    isPending={insightMutation.isPending}
                  />
                </>
              ) : null}

              <ReportCardView report={reportQuery.data!} />
            </>
          )}
        </>
      )}
    </div>
  );
}
