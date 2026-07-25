"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { TableCard } from "@/components/dashboard/table-card";

import { loginErrorMessage } from "@/hooks/use-auth";
import { useActivateStudentMutation, usePendingStudentsQuery } from "@/hooks/use-students";

export function PendingActivationsCard() {
  const { data: students, isLoading, isError, error, refetch } = usePendingStudentsQuery();
  const activateMutation = useActivateStudentMutation();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending student activations</CardTitle>
          <CardDescription>New student sign-ups awaiting your approval</CardDescription>
        </CardHeader>
        <LoadingState label="Loading pending students..." />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending student activations</CardTitle>
          <CardDescription>New student sign-ups awaiting your approval</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <ErrorState message={loginErrorMessage(error)} onRetry={() => refetch()} />
        </div>
      </Card>
    );
  }

  const rows = (students ?? []).map((student) => ({
    name: student.full_name,
    contact: (
      <div className="flex flex-col">
        <span>{student.email ?? "—"}</span>
        <span className="text-xs text-muted-foreground">{student.phone}</span>
      </div>
    ),
    admission_number: student.admission_number,
    action: (
      <Button
        size="sm"
        variant="outline"
        disabled={activateMutation.isPending}
        onClick={() => activateMutation.mutate(student.id)}
      >
        Activate
      </Button>
    ),
  }));

  return (
    <TableCard
      title="Pending student activations"
      meta="New student sign-ups awaiting your approval"
      columns={[
        { key: "name", label: "Name" },
        { key: "contact", label: "Contact" },
        { key: "admission_number", label: "Admission #" },
        { key: "action", label: "", align: "right" },
      ]}
      rows={rows}
      emptyMessage="No pending student sign-ups."
    />
  );
}
