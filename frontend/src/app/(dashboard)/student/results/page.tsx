"use client";

import { useState } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ExamCardView } from "@/components/modules/results/exam-card-view";
import { InsightSummaryCard } from "@/components/modules/results/insight-summary-card";
import { ReportCardView } from "@/components/modules/results/report-card-view";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useMyExamCardQuery, useMyIndividualInsightMutation, useMyReportCardQuery } from "@/hooks/use-results";

export default function StudentResultsPage() {
  const reportQuery = useMyReportCardQuery();
  const [selectedExamId, setSelectedExamId] = useState("");
  const insightMutation = useMyIndividualInsightMutation();

  const exams = reportQuery.data?.exams ?? [];
  const resolvedExamId = selectedExamId || exams[0]?.exam_id || "";
  const examCardQuery = useMyExamCardQuery(resolvedExamId);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My results</h1>
        <p className="text-sm text-muted-foreground">Published exam results and your year-end report card.</p>
      </div>

      {reportQuery.isLoading ? (
        <LoadingState label="Loading results..." />
      ) : reportQuery.isError ? (
        <ErrorState message={loginErrorMessage(reportQuery.error)} onRetry={() => reportQuery.refetch()} />
      ) : exams.length === 0 ? (
        <EmptyState message="No results have been published yet." />
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
                title="My insight summary"
                description="A plain-language summary of your own results for this exam."
                onGenerate={() => insightMutation.mutateAsync(resolvedExamId)}
                isPending={insightMutation.isPending}
              />
            </>
          ) : null}

          <ReportCardView report={reportQuery.data!} />
        </>
      )}
    </div>
  );
}
