"use client";

import { CheckCircle2, CircleAlert, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useUploadSheetsMutation } from "@/hooks/use-omr";
import { cn } from "@/lib/utils";

/** Mirrors the backend's OMR_MAX_SHEETS_PER_REQUEST. Sheets are processed
 * synchronously at roughly a second each, so uploads are sent in chunks this
 * size rather than as one long request. */
const CHUNK_SIZE = 20;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

interface FileOutcome {
  filename: string;
  ok: boolean;
  detail: string;
}

export function SheetUploadDropzone({
  batchId,
  disabled = false,
}: {
  batchId: string;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadSheetsMutation(batchId);

  const [isDragging, setIsDragging] = useState(false);
  const [queued, setQueued] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; percent: number } | null>(
    null
  );
  const [outcomes, setOutcomes] = useState<FileOutcome[]>([]);
  const [error, setError] = useState<string | null>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const accepted: File[] = [];
    const rejected: FileOutcome[] = [];
    for (const file of Array.from(fileList)) {
      if (ACCEPTED.includes(file.type)) {
        accepted.push(file);
      } else {
        rejected.push({
          filename: file.name,
          ok: false,
          detail: "Not a JPEG, PNG, or WEBP image",
        });
      }
    }
    setQueued((prev) => [...prev, ...accepted]);
    if (rejected.length) setOutcomes((prev) => [...prev, ...rejected]);
  }

  function removeQueued(index: number) {
    setQueued((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (!queued.length) return;
    setError(null);
    setOutcomes([]);

    const chunks: File[][] = [];
    for (let i = 0; i < queued.length; i += CHUNK_SIZE) {
      chunks.push(queued.slice(i, i + CHUNK_SIZE));
    }

    const results: FileOutcome[] = [];
    let done = 0;

    try {
      for (const chunk of chunks) {
        setProgress({ done, total: queued.length, percent: 0 });
        const result = await uploadMutation.mutateAsync({
          files: chunk,
          onProgress: (percent) => setProgress({ done, total: queued.length, percent }),
        });

        for (const sheet of result.sheets) {
          results.push({
            filename: sheet.original_filename,
            ok: sheet.status !== "failed",
            detail:
              sheet.status === "failed"
                ? sheet.error_message ?? "The sheet could not be read"
                : `Roll ${sheet.detected_roll ?? "?"} · ${sheet.marks_obtained ?? "—"} marks`,
          });
        }
        for (const rejected of result.rejected) {
          results.push({ filename: rejected.filename, ok: false, detail: rejected.reason });
        }

        done += chunk.length;
      }
      setQueued([]);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setProgress(null);
      setOutcomes(results);
    }
  }

  const isBusy = uploadMutation.isPending || progress !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload answer sheets</CardTitle>
        <CardDescription>
          JPEG, PNG, or WEBP scans. Large uploads are sent {CHUNK_SIZE} sheets at a time — each
          sheet takes about a second to read.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-3 px-4 pb-4">
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (!disabled) addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed px-4 py-8 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/40",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">
            Drop answer sheets here, or click to choose files
          </span>
          <span className="text-xs text-muted-foreground">
            {disabled ? "This batch has been applied and is read-only." : "You can select many at once."}
          </span>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED.join(",")}
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        {queued.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {queued.length} sheet{queued.length === 1 ? "" : "s"} ready to upload
            </span>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {queued.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5 text-sm"
                >
                  <span className="truncate text-foreground">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${file.name}`}
                    disabled={isBusy}
                    onClick={() => removeQueued(index)}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {progress && (
          <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
            <span className="text-sm text-muted-foreground">
              Reading sheets {progress.done + 1}–
              {Math.min(progress.done + CHUNK_SIZE, progress.total)} of {progress.total}…
            </span>
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.round(((progress.done + progress.percent / 100) / progress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {error && <ErrorState message={error} />}

        {outcomes.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Upload results</span>
            {outcomes.map((outcome, index) => (
              <div
                key={`${outcome.filename}-${index}`}
                className="flex items-start gap-2 rounded border border-border bg-card px-2 py-1.5 text-sm"
              >
                {outcome.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                )}
                <span className="truncate font-medium text-foreground">{outcome.filename}</span>
                <span className="text-muted-foreground">{outcome.detail}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <Button onClick={handleUpload} disabled={disabled || !queued.length || isBusy}>
            <Upload className="size-4" aria-hidden="true" />
            {isBusy ? "Reading sheets…" : `Upload ${queued.length || ""} sheet${queued.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </Card>
  );
}
