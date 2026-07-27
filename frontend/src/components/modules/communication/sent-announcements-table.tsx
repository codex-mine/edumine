"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useSentAnnouncementsQuery } from "@/hooks/use-communication";
import { AUDIENCE_TYPE_LABELS, type AudienceType } from "@/lib/api/communication";

const AUDIENCE_OPTIONS: AudienceType[] = ["all", "students", "teachers", "staff", "guardians", "specific_class"];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function SentAnnouncementsTable({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType | "all_types">("all_types");
  const [page, setPage] = useState(1);
  const limit = 20;

  const announcementsQuery = useSentAnnouncementsQuery({
    audience_type: audienceType === "all_types" ? undefined : audienceType,
    page,
    limit,
  });
  const allItems = announcementsQuery.data?.items ?? [];
  const items = search ? allItems.filter((a) => a.title.toLowerCase().includes(search.toLowerCase())) : allItems;

  const rows = items.map((announcement) => ({
    title: <span className="font-medium text-foreground">{announcement.title}</span>,
    audience: announcement.section_label ?? AUDIENCE_TYPE_LABELS[announcement.audience_type],
    recipients: String(announcement.recipient_count),
    sms: announcement.sms_summary ? (
      <Badge variant={announcement.sms_summary.failed > 0 ? "warning" : "success"}>
        {announcement.sms_summary.sent}/{announcement.sms_summary.attempted} sent
      </Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    ),
    sent_by: announcement.created_by_name,
    sent_at: announcement.published_at ? formatDateTime(announcement.published_at) : "—",
  }));

  return (
    <DataTable
      title="Sent announcements"
      description="Announcements this school has sent, by audience."
      columns={[
        { key: "title", label: "Title" },
        { key: "audience", label: "Audience" },
        { key: "recipients", label: "Recipients", align: "right" },
        { key: "sms", label: "SMS" },
        { key: "sent_by", label: "Sent by" },
        { key: "sent_at", label: "Sent at" },
      ]}
      rows={rows}
      isLoading={announcementsQuery.isLoading}
      isError={announcementsQuery.isError}
      errorMessage={announcementsQuery.error ? loginErrorMessage(announcementsQuery.error) : undefined}
      onRetry={() => announcementsQuery.refetch()}
      emptyMessage="No announcements sent yet."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by title"
      page={page}
      limit={limit}
      total={announcementsQuery.data?.meta.total ?? 0}
      onPageChange={setPage}
      onRowClick={(index) => router.push(`${basePath}/${items[index].id}`)}
      toolbarActions={
        <Select
          value={audienceType}
          onValueChange={(value) => {
            setAudienceType(value as AudienceType | "all_types");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[12rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_types">All audiences</SelectItem>
            {AUDIENCE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {AUDIENCE_TYPE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
