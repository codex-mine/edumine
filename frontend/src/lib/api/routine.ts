import { apiClient } from "@/lib/api/client";

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export interface RoutineSlot {
  id: string;
  academic_year_id: string;
  section_id: string;
  section_name: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  teacher_id: string;
  teacher_name: string;
  room_id: string | null;
  room_name: string | null;
  day_of_week: Weekday;
  period_number: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface CreateRoutineSlotPayload {
  academic_year_id?: string | null;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  room_id?: string | null;
  day_of_week: Weekday;
  period_number: number;
  start_time: string;
  end_time: string;
}

export interface UpdateRoutineSlotPayload {
  subject_id?: string;
  teacher_id?: string;
  room_id?: string | null;
  clear_room?: boolean;
  day_of_week?: Weekday;
  period_number?: number;
  start_time?: string;
  end_time?: string;
}

export interface SectionRoutine {
  section_id: string;
  section_name: string;
  class_id: string;
  class_name: string;
  slots: RoutineSlot[];
}

export interface StudentSectionRoutine {
  student_id: string;
  student_name: string;
  section: SectionRoutine;
}

export interface GuardianRoutine {
  children: StudentSectionRoutine[];
}

export function formatSlotTime(slot: RoutineSlot): string {
  return `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`;
}

// --- Admin builder CRUD -----------------------------------------------

export async function listRoutineSlots(params: {
  academic_year_id?: string;
  section_id?: string;
  teacher_id?: string;
  day_of_week?: Weekday;
}): Promise<RoutineSlot[]> {
  const { data } = await apiClient.get<RoutineSlot[]>("/routine/slots", { params });
  return data;
}

export async function createRoutineSlot(payload: CreateRoutineSlotPayload): Promise<RoutineSlot> {
  const { data } = await apiClient.post<RoutineSlot>("/routine/slots", payload);
  return data;
}

export async function updateRoutineSlot(slotId: string, payload: UpdateRoutineSlotPayload): Promise<RoutineSlot> {
  const { data } = await apiClient.patch<RoutineSlot>(`/routine/slots/${slotId}`, payload);
  return data;
}

export async function deleteRoutineSlot(slotId: string): Promise<void> {
  await apiClient.delete(`/routine/slots/${slotId}`);
}

// --- Scoped views -------------------------------------------------------

export async function getSectionRoutine(sectionId: string): Promise<SectionRoutine> {
  const { data } = await apiClient.get<SectionRoutine>(`/routine/sections/${sectionId}`);
  return data;
}

export async function getMyTeacherRoutine(): Promise<RoutineSlot[]> {
  const { data } = await apiClient.get<RoutineSlot[]>("/routine/me/teacher");
  return data;
}

export async function getMyStudentRoutine(): Promise<StudentSectionRoutine> {
  const { data } = await apiClient.get<StudentSectionRoutine>("/routine/me/student");
  return data;
}

export async function getMyGuardianRoutine(): Promise<GuardianRoutine> {
  const { data } = await apiClient.get<GuardianRoutine>("/routine/me/guardian");
  return data;
}
