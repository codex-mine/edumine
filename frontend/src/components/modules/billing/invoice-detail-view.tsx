"use client";

import { Ban, Percent, Printer, Receipt as ReceiptIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AddDiscountDialog } from "@/components/modules/billing/add-discount-dialog";
import { RecordPaymentDialog } from "@/components/modules/billing/record-payment-dialog";
import { useCancelInvoiceMutation } from "@/hooks/use-billing";
import { INVOICE_STATUS_LABELS, type InvoiceDetail } from "@/lib/api/billing";

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  paid: "success",
  partially_paid: "info",
  unpaid: "warning",
  overdue: "destructive",
  cancelled: "muted",
};

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceDetailView({
  invoice,
  canManage = false,
  canCollectPayment = false,
  onPaymentRecorded,
}: {
  invoice: InvoiceDetail;
  canManage?: boolean;
  canCollectPayment?: boolean;
  onPaymentRecorded?: (paymentId: string) => void;
}) {
  const cancelMutation = useCancelInvoiceMutation();
  const canCancel = canManage && invoice.status !== "cancelled" && invoice.paid_amount === 0;
  const canRecordPayment = canCollectPayment && invoice.status !== "cancelled" && invoice.due_amount > 0;
  const canAddDiscount = canManage && invoice.status !== "cancelled";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap gap-2">
          {canRecordPayment && (
            <RecordPaymentDialog
              invoice={invoice}
              onRecorded={onPaymentRecorded}
              trigger={
                <Button size="sm">
                  <ReceiptIcon className="size-4" aria-hidden="true" />
                  Record payment
                </Button>
              }
            />
          )}
          {canAddDiscount && (
            <AddDiscountDialog
              invoice={invoice}
              trigger={
                <Button size="sm" variant="outline">
                  <Percent className="size-4" aria-hidden="true" />
                  Add discount
                </Button>
              }
            />
          )}
          {canCancel && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Ban className="size-4" aria-hidden="true" />
                  Cancel invoice
                </Button>
              }
              title="Cancel this invoice?"
              description="This invoice has no payments recorded yet and will be marked as cancelled."
              confirmLabel="Cancel invoice"
              onConfirm={() => cancelMutation.mutate(invoice.id)}
              isPending={cancelMutation.isPending}
            />
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print
        </Button>
      </div>

      <Card className="print-area">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Invoice {invoice.invoice_number}</CardTitle>
            <Badge variant={STATUS_BADGE_VARIANT[invoice.status] ?? "muted"}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
          </div>
          <CardDescription>
            {invoice.student_name} ({invoice.admission_number}) &middot; Due {invoice.due_date}
          </CardDescription>
        </CardHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Fee item</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {item.fee_type_name}
                      {item.description && <span className="block text-xs text-muted-foreground">{item.description}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{formatMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invoice.discounts.length > 0 && (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Discount</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Reason</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.discounts.map((discount) => (
                    <tr key={discount.id}>
                      <td className="px-3 py-2">
                        {discount.discount_type === "flat" ? "Flat" : `${discount.value}%`}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{discount.reason ?? "—"}</td>
                      <td className="px-3 py-2 text-right">-{formatMoney(discount.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-1 rounded border border-border p-3 text-sm sm:w-72 sm:self-end">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(invoice.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatMoney(invoice.discount_total)}</span>
            </div>
            <div className="flex items-center justify-between font-medium text-foreground">
              <span>Total</span>
              <span>{formatMoney(invoice.total_amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>{formatMoney(invoice.paid_amount)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1 font-medium text-foreground">
              <span>Due</span>
              <span>{formatMoney(invoice.due_amount)}</span>
            </div>
          </div>

          {invoice.payments.length > 0 && (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Paid at</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Method</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Reference</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Received by</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-3 py-2">{new Date(payment.paid_at).toLocaleString()}</td>
                      <td className="px-3 py-2 capitalize">{payment.method.replace("_", " ")}</td>
                      <td className="px-3 py-2 text-muted-foreground">{payment.transaction_reference ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{payment.received_by_name}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
