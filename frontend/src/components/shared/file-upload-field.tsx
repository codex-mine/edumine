"use client";

import { useId, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/api/uploads";

export function FileUploadField({
  label,
  value,
  onChange,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
}: {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  accept?: string;
}) {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const result = await uploadFile(file);
      onChange(result.url);
    } catch {
      setError("Upload failed — try again");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline"   disabled={isUploading} asChild>
          <label htmlFor={inputId} className="cursor-pointer">
            {isUploading ? (
              <Loader2 className="size-8 animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip className="size-8" aria-hidden="true" />
            )}
            {value ? "Replace file" : "Upload file"}
          </label>
        </Button>
        <input id={inputId} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
        {value && (
          <>
            <a href={value} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
              View uploaded file
            </a>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
