import { Badge } from "@/components/ui/badge";

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? "success" : "muted"}>{isActive ? "Active" : "Inactive"}</Badge>;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  active: "success",
  on_leave: "warning",
  resigned: "muted",
  terminated: "destructive",
  transferred: "info",
  graduated: "info",
  dropped: "destructive",
  promoted: "info",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? "muted";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}
