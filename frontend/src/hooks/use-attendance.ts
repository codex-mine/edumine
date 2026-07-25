import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDevice,
  getClassRoster,
  getMyDailyAttendance,
  getStudentCombinedDaily,
  listClassAttendance,
  listDailyAttendance,
  listDevices,
  markClassAttendance,
  updateDevice,
  type CreateBiometricDevicePayload,
  type MarkClassAttendancePayload,
  type UpdateBiometricDevicePayload,
} from "@/lib/api/attendance";

// --- Biometric devices ---------------------------------------------------

export const devicesQueryKey = ["attendance", "devices"] as const;

export function useDevicesQuery() {
  return useQuery({ queryKey: devicesQueryKey, queryFn: listDevices });
}

export function useCreateDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBiometricDevicePayload) => createDevice(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: devicesQueryKey }),
  });
}

export function useUpdateDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, payload }: { deviceId: string; payload: UpdateBiometricDevicePayload }) =>
      updateDevice(deviceId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: devicesQueryKey }),
  });
}

// --- Daily (biometric) attendance ------------------------------------------

export const dailyAttendanceQueryKey = (params: { user_id?: string; date_from?: string; date_to?: string }) =>
  ["attendance", "daily", params] as const;
export const myDailyAttendanceQueryKey = (params: { date_from?: string; date_to?: string }) =>
  ["attendance", "daily", "me", params] as const;

export function useDailyAttendanceQuery(params: { user_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({ queryKey: dailyAttendanceQueryKey(params), queryFn: () => listDailyAttendance(params) });
}

export function useMyDailyAttendanceQuery(params: { date_from?: string; date_to?: string } = {}) {
  return useQuery({ queryKey: myDailyAttendanceQueryKey(params), queryFn: () => getMyDailyAttendance(params) });
}

// --- Subject-wise class attendance ------------------------------------------

export const classRosterQueryKey = (routineSlotId: string, attendanceDate: string) =>
  ["attendance", "class", "roster", routineSlotId, attendanceDate] as const;

export function useClassRosterQuery(routineSlotId: string, attendanceDate: string) {
  return useQuery({
    queryKey: classRosterQueryKey(routineSlotId || "none", attendanceDate),
    queryFn: () => getClassRoster({ routine_slot_id: routineSlotId, attendance_date: attendanceDate }),
    enabled: Boolean(routineSlotId && attendanceDate),
  });
}

export const classAttendanceQueryKey = (params: {
  attendance_date: string;
  routine_slot_id?: string;
  section_id?: string;
}) => ["attendance", "class", "list", params] as const;

export function useClassAttendanceQuery(params: { attendance_date: string; routine_slot_id?: string; section_id?: string }) {
  return useQuery({
    queryKey: classAttendanceQueryKey(params),
    queryFn: () => listClassAttendance(params),
    enabled: Boolean(params.attendance_date && (params.routine_slot_id || params.section_id)),
  });
}

export function useMarkClassAttendanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MarkClassAttendancePayload) => markClassAttendance(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: classRosterQueryKey(variables.routine_slot_id, variables.attendance_date),
      });
      queryClient.invalidateQueries({ queryKey: ["attendance", "class"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "students"] });
    },
  });
}

// --- Combined per-student daily view -----------------------------------

export const studentCombinedDailyQueryKey = (studentId: string, attendanceDate?: string) =>
  ["attendance", "students", studentId, attendanceDate ?? "today"] as const;

export function useStudentCombinedDailyQuery(studentId: string, attendanceDate?: string) {
  return useQuery({
    queryKey: studentCombinedDailyQueryKey(studentId || "none", attendanceDate),
    queryFn: () => getStudentCombinedDaily(studentId, attendanceDate),
    enabled: Boolean(studentId),
  });
}
