import { PendingActivationsCard } from "@/components/dashboard/pending-activations-card";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function AdminDashboardPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <DashboardShell role="admin" />
      <PendingActivationsCard />
    </div>
  );
}
