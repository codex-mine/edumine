"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useInboxAnnouncementsQuery } from "@/hooks/use-communication";
import { AUDIENCE_TYPE_LABELS } from "@/lib/api/communication";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function InboxAnnouncementsTable({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const announcementsQuery = useInboxAnnouncementsQuery({ page, limit });
  const allItems = announcementsQuery.data?.items ?? [];
  const items = search ? allItems.filter((a) => a.title.toLowerCase().includes(search.toLowerCase())) : allItems;

  const rows = items.map((announcement) => ({
    title: (
      <span className={announcement.read_at ? "text-foreground" : "font-semibold text-foreground"}>
        {announcement.title}
      </span>
    ),
    audience: announcement.section_label ?? AUDIENCE_TYPE_LABELS[announcement.audience_type],
    from: announcement.created_by_name,
    received_at: formatDateTime(announcement.created_at),
    status: announcement.read_at ? (
      <Badge variant="muted">Read</Badge>
    ) : (
      <Badge variant="info">New</Badge>
    ),
  }));

  return (
    <DataTable
      title="Inbox"
      description="Announcements addressed to you."
      columns={[
        { key: "title", label: "Title" },
        { key: "audience", label: "Audience" },
        { key: "from", label: "From" },
        { key: "received_at", label: "Received" },
        { key: "status", label: "" },
      ]}
      rows={rows}
      isLoading={announcementsQuery.isLoading}
      isError={announcementsQuery.isError}
      errorMessage={announcementsQuery.error ? loginErrorMessage(announcementsQuery.error) : undefined}
      onRetry={() => announcementsQuery.refetch()}
      emptyMessage="No announcements yet."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by title"
      page={page}
      limit={limit}
      total={announcementsQuery.data?.meta.total ?? 0}
      onPageChange={setPage}
      onRowClick={(index) => router.push(`${basePath}/${items[index].id}`)}
    />
  );
}
