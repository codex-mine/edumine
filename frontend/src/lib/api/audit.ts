import { getPaginated, type PageMeta } from "@/lib/api/client";

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface ListAuditLogsParams {
  /** Only actions performed by this user. */
  actor_id?: string;
  entity_type?: string;
  entity_id?: string;
  /** A person's user id: what they did, plus what was done to their user record. */
  subject_id?: string;
  /** Their student/teacher profile id — those modules log against it, not the user id. */
  profile_id?: string;
  date_from?: string;
  date_to?: string;
  page: number;
  limit: number;
}

export async function listAuditLogs(
  params: ListAuditLogsParams
): Promise<{ items: AuditLog[]; meta: PageMeta }> {
  return getPaginated<AuditLog>("/audit/logs", { ...params });
}

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  soft_delete: "Deleted",
  hard_delete: "Permanently deleted",
  link_guardian: "Linked guardian",
  unlink_guardian: "Unlinked guardian",
  update_guardian_link: "Updated guardian link",
  enroll: "Enrolled",
  promote: "Promoted",
  record_payment: "Recorded payment",
  cancel: "Cancelled",
  approve: "Approved",
  reject: "Rejected",
  publish: "Published",
  submit: "Submitted",
  compile: "Compiled results",
};

/** Turns an audit row into a readable sentence, e.g. "Updated student". */
export function describeAuditLog(log: AuditLog): string {
  const action = ACTION_LABELS[log.action] ?? log.action.replace(/_/g, " ");
  return `${action} ${log.entity_type.replace(/_/g, " ")}`;
}
