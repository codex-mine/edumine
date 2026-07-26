import { apiClient } from "@/lib/api/client";

export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "leave";
export type ClassAttendanceStatus = "present" | "absent" | "late";

export const CLASS_ATTENDANCE_STATUSES: ClassAttendanceStatus[] = ["present", "absent", "late"];

export interface BiometricDevice {
  id: string;
  device_serial: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateBiometricDevicePayload {
  device_serial: string;
  location?: string | null;
}

export interface UpdateBiometricDevicePayload {
  location?: string | null;
  is_active?: boolean;
}

export interface DailyAttendance {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  attendance_date: string;
  entry_time: string | null;
  exit_time: string | null;
  status: AttendanceStatus;
}

export interface ClassAttendanceRosterItem {
  student_id: string;
  student_name: string;
  admission_number: string;
  roll_number: string;
  status: ClassAttendanceStatus | null;
  marked_at: string | null;
}

export interface ClassAttendanceRoster {
  routine_slot_id: string;
  section_id: string;
  section_name: string;
  subject_name: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  attendance_date: string;
  window_open: boolean;
  roster: ClassAttendanceRosterItem[];
}

export interface MarkClassAttendanceItem {
  student_id: string;
  status: ClassAttendanceStatus;
}

export interface MarkClassAttendancePayload {
  routine_slot_id: string;
  attendance_date: string;
  items: MarkClassAttendanceItem[];
}

export interface ClassAttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  routine_slot_id: string;
  subject_name: string;
  section_name: string;
  attendance_date: string;
  status: ClassAttendanceStatus;
  marked_by: string;
  marked_by_name: string;
  marked_at: string;
}

export interface AttendancePeriodEntry {
  routine_slot_id: string;
  period_number: number;
  subject_name: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  status: ClassAttendanceStatus | null;
  marked_at: string | null;
}

export interface CombinedDailyAttendance {
  student_id: string;
  student_name: string;
  attendance_date: string;
  entry_time: string | null;
  exit_time: string | null;
  biometric_status: AttendanceStatus | null;
  periods: AttendancePeriodEntry[];
}

export function formatAttendanceTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// --- Biometric devices ---------------------------------------------------

export async function listDevices(): Promise<BiometricDevice[]> {
  const { data } = await apiClient.get<BiometricDevice[]>("/attendance/devices");
  return data;
}

export async function createDevice(payload: CreateBiometricDevicePayload): Promise<BiometricDevice> {
  const { data } = await apiClient.post<BiometricDevice>("/attendance/devices", payload);
  return data;
}

export async function updateDevice(deviceId: string, payload: UpdateBiometricDevicePayload): Promise<BiometricDevice> {
  const { data } = await apiClient.patch<BiometricDevice>(`/attendance/devices/${deviceId}`, payload);
  return data;
}

// --- Daily (biometric) attendance ------------------------------------------

export async function listDailyAttendance(params: {
  user_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<DailyAttendance[]> {
  const { data } = await apiClient.get<DailyAttendance[]>("/attendance/daily", { params });
  return data;
}

export async function getMyDailyAttendance(params: { date_from?: string; date_to?: string }): Promise<DailyAttendance[]> {
  const { data } = await apiClient.get<DailyAttendance[]>("/attendance/daily/me", { params });
  return data;
}

// --- Subject-wise class attendance ------------------------------------------

export async function getClassRoster(params: {
  routine_slot_id: string;
  attendance_date: string;
}): Promise<ClassAttendanceRoster> {
  const { data } = await apiClient.get<ClassAttendanceRoster>("/attendance/class/roster", { params });
  return data;
}

export async function markClassAttendance(payload: MarkClassAttendancePayload): Promise<ClassAttendanceRecord[]> {
  const { data } = await apiClient.post<ClassAttendanceRecord[]>("/attendance/class/mark", payload);
  return data;
}

export async function listClassAttendance(params: {
  attendance_date: string;
  routine_slot_id?: string;
  section_id?: string;
}): Promise<ClassAttendanceRecord[]> {
  const { data } = await apiClient.get<ClassAttendanceRecord[]>("/attendance/class", { params });
  return data;
}

// --- Combined per-student daily view -----------------------------------

export async function getStudentCombinedDaily(
  studentId: string,
  attendanceDate?: string
): Promise<CombinedDailyAttendance> {
  const { data } = await apiClient.get<CombinedDailyAttendance>(`/attendance/students/${studentId}/daily`, {
    params: attendanceDate ? { attendance_date: attendanceDate } : undefined,
  });
  return data;
}
