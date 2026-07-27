import { Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Section 4.6 — Financial Narrative Summary. Principal-only: this component is only ever
 * rendered from the Principal dashboard, and the backend independently re-verifies the
 * caller's role is Principal before generating it (prompts.md §4.6). */
export function FinancialNarrativeCard({
  narrative,
  narrativeError,
}: {
  narrative: string | null;
  narrativeError: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Financial narrative summary
        </CardTitle>
        <CardDescription>An AI-generated summary of this month&apos;s figures — factual only, no projections.</CardDescription>
      </CardHeader>
      <CardContent>
        {narrative ? (
          <p className="text-sm leading-relaxed text-foreground">{narrative}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {narrativeError ?? "A summary isn't available right now."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
