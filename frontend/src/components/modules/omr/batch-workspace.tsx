"use client";

import { ArrowLeft, Download, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ApplyToRosterDialog } from "@/components/modules/omr/apply-to-roster-dialog";
import { SheetDetailDialog } from "@/components/modules/omr/sheet-detail-dialog";
import { SheetReviewTable } from "@/components/modules/omr/sheet-review-table";
import { SheetUploadDropzone } from "@/components/modules/omr/sheet-upload-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useBatchQuery } from "@/hooks/use-omr";
import { BATCH_STATUS_LABELS, downloadBatchExport, type BatchStatus } from "@/lib/api/omr";

const STATUS_VARIANT: Record<BatchStatus, "default" | "success" | "warning" | "destructive"> = {
  draft: "default",
  processing: "warning",
  ready: "success",
  applied: "success",
  failed: "destructive",
};

export function BatchWorkspace({
  batchId,
  backHref,
  answerKeysHref,
}: {
  batchId: string;
  backHref: string;
  answerKeysHref: string;
}) {
  const batchQuery = useBatchQuery(batchId);
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload(format: "csv" | "excel") {
    setDownloadError(null);
    setIsDownloading(true);
    try {
      const { blob, filename } = await downloadBatchExport(batchId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(loginErrorMessage(error));
    } finally {
      setIsDownloading(false);
    }
  }

  if (batchQuery.isLoading) return <LoadingState label="Loading batch..." />;
  if (batchQuery.isError) {
    return (
      <ErrorState message={loginErrorMessage(batchQuery.error)} onRetry={() => batchQuery.refetch()} />
    );
  }

  const batch = batchQuery.data!;
  const isApplied = batch.status === "applied";

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link href={backHref}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            All batches
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">{batch.name}</h1>
              <Badge variant={STATUS_VARIANT[batch.status]}>
                {BATCH_STATUS_LABELS[batch.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {batch.sheet_count} sheet{batch.sheet_count === 1 ? "" : "s"} ·{" "}
              {batch.matched_count} matched · {batch.failed_count} failed · out of{" "}
              {batch.mcq_full_marks} marks
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={answerKeysHref}>
                <KeyRound className="size-4" aria-hidden="true" />
                Answer keys
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownload("excel")}
              disabled={isDownloading || batch.sheet_count === 0}
            >
              <Download className="size-4" aria-hidden="true" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownload("csv")}
              disabled={isDownloading || batch.sheet_count === 0}
            >
              <Download className="size-4" aria-hidden="true" />
              CSV
            </Button>
            <ApplyToRosterDialog batch={batch} examSubjectId={batch.exam_subject_id} />
          </div>
        </div>
      </div>

      {downloadError && <ErrorState message={downloadError} />}

      {isApplied && (
        <Card>
          <CardHeader>
            <CardTitle>This batch has been applied</CardTitle>
            <CardDescription>
              Its scores are in the marks roster and the sheets are now read-only. Submit the marks
              from the marks entry screen when you are ready.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isApplied && <SheetUploadDropzone batchId={batchId} disabled={isApplied} />}

      <SheetReviewTable batchId={batchId} onOpenSheet={setOpenSheetId} />

      <SheetDetailDialog
        sheetId={openSheetId}
        batchId={batchId}
        examSubjectId={batch.exam_subject_id}
        readOnly={isApplied}
        onClose={() => setOpenSheetId(null)}
      />
    </div>
  );
}
