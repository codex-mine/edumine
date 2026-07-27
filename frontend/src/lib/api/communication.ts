import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";

export type AudienceType = "all" | "students" | "teachers" | "staff" | "guardians" | "specific_class";
export type SmsStatus = "queued" | "sent" | "failed";

export const AUDIENCE_TYPE_LABELS: Record<AudienceType, string> = {
  all: "Everyone",
  students: "Students",
  teachers: "Teachers",
  staff: "Staff",
  guardians: "Guardians",
  specific_class: "Specific class/section",
};

export const SMS_STATUS_LABELS: Record<SmsStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  failed: "Failed",
};

// --- Sections (audience picker) ---------------------------------------------------------

export interface CommunicationSection {
  id: string;
  name: string;
  class_name: string;
  label: string;
}

export async function listCommunicationSections(): Promise<CommunicationSection[]> {
  const { data } = await apiClient.get<CommunicationSection[]>("/communication/sections");
  return data;
}

// --- Announcements -----------------------------------------------------------------------

export interface SmsSummary {
  attempted: number;
  sent: number;
  failed: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience_type: AudienceType;
  section_id: string | null;
  section_label: string | null;
  created_by: string;
  created_by_name: string;
  published_at: string | null;
  recipient_count: number;
  read_at: string | null;
  created_at: string;
  sms_summary: SmsSummary | null;
}

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  audience_type: AudienceType;
  section_id?: string;
  send_sms: boolean;
  sms_message?: string;
}

export async function createAnnouncement(payload: CreateAnnouncementPayload): Promise<Announcement> {
  const { data } = await apiClient.post<Announcement>("/communication/announcements", payload);
  return data;
}

export async function listSentAnnouncements(params: {
  audience_type?: AudienceType;
  page: number;
  limit: number;
}): Promise<{ items: Announcement[]; meta: PageMeta }> {
  return getPaginated<Announcement>("/communication/announcements/sent", params);
}

export async function listInboxAnnouncements(params: {
  page: number;
  limit: number;
}): Promise<{ items: Announcement[]; meta: PageMeta }> {
  return getPaginated<Announcement>("/communication/announcements/inbox", params);
}

export async function getAnnouncement(announcementId: string): Promise<Announcement> {
  const { data } = await apiClient.get<Announcement>(`/communication/announcements/${announcementId}`);
  return data;
}

export async function markAnnouncementRead(announcementId: string): Promise<void> {
  await apiClient.post(`/communication/announcements/${announcementId}/read`, {});
}

// --- SMS delivery logs -------------------------------------------------------------------

export interface SmsLog {
  id: string;
  recipient_phone: string;
  message: string;
  status: SmsStatus;
  sent_at: string | null;
  created_at: string;
}

export async function getAnnouncementSmsLogs(announcementId: string): Promise<SmsLog[]> {
  const { data } = await apiClient.get<SmsLog[]>(`/communication/announcements/${announcementId}/sms-logs`);
  return data;
}

// --- AI draft-assist (Admin/Principal only) -----------------------------------------------

export interface DraftAnnouncementPayload {
  topic: string;
  audience_type: AudienceType;
  details: string;
  tone?: string;
  char_limit?: number;
}

export interface AnnouncementDraft {
  announcement_body: string;
  sms_variant: string | null;
}

export async function draftAnnouncement(payload: DraftAnnouncementPayload): Promise<AnnouncementDraft> {
  const { data } = await apiClient.post<AnnouncementDraft>("/communication/announcements/draft", payload);
  return data;
}
