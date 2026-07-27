import { useMutation, useQuery } from "@tanstack/react-query";

import {
  askGuardianAssistant,
  generateAtRiskStudents,
  generateAttendanceInsight,
  getAccountantDashboard,
  getAdminDashboard,
  getGuardianDashboard,
  getPrincipalDashboard,
  getReceptionistDashboard,
  getStaffDashboard,
  getStudentDashboard,
  getTeacherDashboard,
  type AtRiskStudentsPayload,
  type AttendanceInsightPayload,
  type GuardianAssistantPayload,
} from "@/lib/api/dashboard";

export function usePrincipalDashboardQuery() {
  return useQuery({ queryKey: ["dashboard", "principal"], queryFn: getPrincipalDashboard });
}

export function useAdminDashboardQuery() {
  return useQuery({ queryKey: ["dashboard", "admin"], queryFn: getAdminDashboard });
}

export function useTeacherDashboardQuery() {
  return useQuery({ queryKey: ["dashboard", "teacher"], queryFn: getTeacherDashboard });
}

export function useAccountantDashboardQuery() {
  return useQuery({ queryKey: ["dashboard", "accountant"], queryFn: getAccountantDashboard });
}

export function useReceptionistDashboardQuery() {
  return useQuery({ queryKey: ["dashboard", "receptionist"], queryFn: getReceptionistDashboard });
}

export function useStaffDashboardQuery() {
  return useQuery({ queryKey: ["dashboard", "staff"], queryFn: getStaffDashboard });
}

export function useStudentDashboardQuery() {
  return useQuery({ queryKey: ["dashboard", "student"], queryFn: getStudentDashboard });
}

export function useGuardianDashboardQuery() {
  return useQuery({ queryKey: ["dashboard", "guardian"], queryFn: getGuardianDashboard });
}

// --- On-demand AI widgets ----------------------------------------------------------------

export function useAttendanceInsightMutation() {
  return useMutation({
    mutationFn: (payload: AttendanceInsightPayload) => generateAttendanceInsight(payload),
  });
}

export function useAtRiskStudentsMutation() {
  return useMutation({
    mutationFn: (payload: AtRiskStudentsPayload) => generateAtRiskStudents(payload),
  });
}

export function useGuardianAssistantMutation() {
  return useMutation({
    mutationFn: (payload: GuardianAssistantPayload) => askGuardianAssistant(payload),
  });
}
