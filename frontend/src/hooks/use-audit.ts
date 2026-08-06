import { useQuery } from "@tanstack/react-query";

import { listAuditLogs, type ListAuditLogsParams } from "@/lib/api/audit";

export const auditLogsQueryKey = (params: ListAuditLogsParams) => ["audit", "logs", params] as const;

export function useAuditLogsQuery(params: ListAuditLogsParams, enabled = true) {
  return useQuery({
    queryKey: auditLogsQueryKey(params),
    queryFn: () => listAuditLogs(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}
