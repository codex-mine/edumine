import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

const ROLE_LABELS: Record<Role, string> = {
  principal: "Principal",
  admin: "Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  receptionist: "Receptionist",
  staff: "Staff",
  student: "Student",
  guardian: "Guardian",
};

export function DashboardShell({ role }: { role: Role }) {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>{ROLE_LABELS[role]} dashboard</CardTitle>
        <CardDescription>
          You are signed in and correctly routed to your role&apos;s workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState message="Dashboard widgets will appear here in a future phase." />
      </CardContent>
    </Card>
  );
}
