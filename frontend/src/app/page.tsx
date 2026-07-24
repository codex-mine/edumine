"use client";

import { CheckCircle2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { useHealth } from "@/hooks/use-health";

export default function Home() {
  const { data, isLoading, isError, error, refetch } = useHealth();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Backend connectivity</CardTitle>
          <CardDescription>
            Health-check call from the frontend to the API, unwrapped from the
            standard response envelope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingState label="Checking API health..." />}
          {isError && (
            <ErrorState
              message={error instanceof Error ? error.message : "Unable to reach the API."}
              onRetry={() => refetch()}
            />
          )}
          {!isLoading && !isError && !data && <EmptyState message="No health data returned." />}
          {!isLoading && !isError && data && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              <span>
                API status: <span className="font-medium">{data.status}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
