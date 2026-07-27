"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PayrollRunDetailView } from "@/components/modules/payroll/payroll-run-detail-view";
import { loginErrorMessage } from "@/hooks/use-auth";
import { usePayrollRunQuery } from "@/hooks/use-payroll";
import { useAuth } from "@/providers/auth-provider";

export default function AccountantPayrollRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const runQuery = usePayrollRunQuery(params.runId);

  if (runQuery.isLoading) return <LoadingState label="Loading payroll run..." />;
  if (runQuery.isError || !runQuery.data) {
    return <ErrorState message={loginErrorMessage(runQuery.error)} onRetry={() => runQuery.refetch()} />;
  }

  const permissions = user?.permissions ?? [];

  return (
    <div className="flex w-full flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/accountant/payroll/runs")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to payroll runs
      </Button>
      <PayrollRunDetailView run={runQuery.data} canManage={permissions.includes("payroll.manage")} />
    </div>
  );
}
