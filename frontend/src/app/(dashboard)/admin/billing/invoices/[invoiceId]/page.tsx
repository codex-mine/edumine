"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { InvoiceDetailView } from "@/components/modules/billing/invoice-detail-view";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useInvoiceQuery } from "@/hooks/use-billing";
import { useAuth } from "@/providers/auth-provider";

export default function AdminInvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const invoiceQuery = useInvoiceQuery(params.invoiceId);

  if (invoiceQuery.isLoading) return <LoadingState label="Loading invoice..." />;
  if (invoiceQuery.isError || !invoiceQuery.data) {
    return <ErrorState message={loginErrorMessage(invoiceQuery.error)} onRetry={() => invoiceQuery.refetch()} />;
  }

  const permissions = user?.permissions ?? [];

  return (
    <div className="flex w-full flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit print:hidden" onClick={() => router.push("/admin/billing/invoices")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to invoices
      </Button>
      <InvoiceDetailView
        invoice={invoiceQuery.data}
        canManage={permissions.includes("billing.manage")}
        canCollectPayment={permissions.includes("billing.collect_payment")}
      />
    </div>
  );
}
