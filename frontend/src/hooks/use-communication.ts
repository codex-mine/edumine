import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAnnouncement,
  draftAnnouncement,
  getAnnouncement,
  getAnnouncementSmsLogs,
  listCommunicationSections,
  listInboxAnnouncements,
  listSentAnnouncements,
  markAnnouncementRead,
  type AudienceType,
  type CreateAnnouncementPayload,
  type DraftAnnouncementPayload,
} from "@/lib/api/communication";

// --- Sections --------------------------------------------------------------------------

export const communicationSectionsQueryKey = ["communication", "sections"] as const;

export function useCommunicationSectionsQuery(enabled = true) {
  return useQuery({ queryKey: communicationSectionsQueryKey, queryFn: listCommunicationSections, enabled });
}

// --- Announcements -----------------------------------------------------------------------

export const sentAnnouncementsQueryKey = (params: { audience_type?: AudienceType; page: number; limit: number }) =>
  ["communication", "sent", params] as const;

export function useSentAnnouncementsQuery(params: { audience_type?: AudienceType; page: number; limit: number }) {
  return useQuery({ queryKey: sentAnnouncementsQueryKey(params), queryFn: () => listSentAnnouncements(params) });
}

export const inboxAnnouncementsQueryKey = (params: { page: number; limit: number }) =>
  ["communication", "inbox", params] as const;

export function useInboxAnnouncementsQuery(params: { page: number; limit: number }) {
  return useQuery({ queryKey: inboxAnnouncementsQueryKey(params), queryFn: () => listInboxAnnouncements(params) });
}

export const announcementQueryKey = (announcementId: string) => ["communication", "announcement", announcementId] as const;

export function useAnnouncementQuery(announcementId: string | null) {
  return useQuery({
    queryKey: announcementQueryKey(announcementId ?? ""),
    queryFn: () => getAnnouncement(announcementId as string),
    enabled: Boolean(announcementId),
  });
}

export function useCreateAnnouncementMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAnnouncementPayload) => createAnnouncement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication", "sent"] });
      queryClient.invalidateQueries({ queryKey: ["communication", "inbox"] });
    },
  });
}

export function useMarkAnnouncementReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (announcementId: string) => markAnnouncementRead(announcementId),
    onSuccess: (_data, announcementId) => {
      queryClient.invalidateQueries({ queryKey: ["communication", "inbox"] });
      queryClient.invalidateQueries({ queryKey: announcementQueryKey(announcementId) });
    },
  });
}

// --- SMS delivery logs -------------------------------------------------------------------

export const announcementSmsLogsQueryKey = (announcementId: string) => ["communication", "sms-logs", announcementId] as const;

export function useAnnouncementSmsLogsQuery(announcementId: string | null) {
  return useQuery({
    queryKey: announcementSmsLogsQueryKey(announcementId ?? ""),
    queryFn: () => getAnnouncementSmsLogs(announcementId as string),
    enabled: Boolean(announcementId),
  });
}

// --- AI draft-assist ---------------------------------------------------------------------

export function useDraftAnnouncementMutation() {
  return useMutation({
    mutationFn: (payload: DraftAnnouncementPayload) => draftAnnouncement(payload),
  });
}
