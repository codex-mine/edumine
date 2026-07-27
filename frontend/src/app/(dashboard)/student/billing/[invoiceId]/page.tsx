"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { InvoiceDetailView } from "@/components/modules/billing/invoice-detail-view";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useInvoiceQuery } from "@/hooks/use-billing";

export default function StudentInvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const router = useRouter();
  const invoiceQuery = useInvoiceQuery(params.invoiceId);

  if (invoiceQuery.isLoading) return <LoadingState label="Loading invoice..." />;
  if (invoiceQuery.isError || !invoiceQuery.data) {
    return <ErrorState message={loginErrorMessage(invoiceQuery.error)} onRetry={() => invoiceQuery.refetch()} />;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit print:hidden" onClick={() => router.push("/student/billing")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to my billing
      </Button>
      <InvoiceDetailView invoice={invoiceQuery.data} />
    </div>
  );
}
