"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginErrorMessage } from "@/hooks/use-auth";
import type { InsightSummary } from "@/lib/api/results";

/** AI-assisted Result Insight Summary (prompts.md §4.2). Only ever rendered once
 * the caller has confirmed results are published — this component itself has
 * no knowledge of publish state, it just triggers `onGenerate` on demand. */
export function InsightSummaryCard({
  title = "AI insight summary",
  description = "Generate a plain-language summary of these published results.",
  onGenerate,
  isPending,
}: {
  title?: string;
  description?: string;
  onGenerate: () => Promise<InsightSummary>;
  isPending: boolean;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    try {
      const result = await onGenerate();
      setSummary(result.summary);
    } catch (generateError) {
      setError(loginErrorMessage(generateError));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {summary && <p className="rounded border border-border bg-muted/50 p-3 text-sm text-foreground">{summary}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={handleGenerate} disabled={isPending}>
            <Sparkles className="size-4" /> {isPending ? "Generating..." : summary ? "Regenerate summary" : "Generate summary"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
