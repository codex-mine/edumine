import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  activateStudent,
  createStudent,
  getOwnStudentProfile,
  getStudent,
  hardDeleteStudent,
  linkGuardianToStudent,
  listPendingStudents,
  listStudents,
  softDeleteStudent,
  unlinkGuardianFromStudent,
  updateGuardianLink,
  updateStudent,
  type CreateStudentPayload,
  type StudentStatus,
  type UpdateStudentPayload,
} from "@/lib/api/students";

export const pendingStudentsQueryKey = ["students", "pending"] as const;
export const studentsQueryKey = (params: { page: number; limit: number; search?: string; status?: StudentStatus }) =>
  ["students", "list", params] as const;
export const studentQueryKey = (id: string) => ["students", "detail", id] as const;
export const ownStudentQueryKey = ["students", "me"] as const;

export function usePendingStudentsQuery() {
  return useQuery({
    queryKey: pendingStudentsQueryKey,
    queryFn: listPendingStudents,
  });
}

export function useActivateStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => activateStudent(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingStudentsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["students", "list"] });
    },
  });
}

export function useStudentsQuery(params: { page: number; limit: number; search?: string; status?: StudentStatus }) {
  return useQuery({
    queryKey: studentsQueryKey(params),
    queryFn: () => listStudents(params),
    placeholderData: (previous) => previous,
  });
}

export function useStudentQuery(studentId: string | null) {
  return useQuery({
    queryKey: studentId ? studentQueryKey(studentId) : ["students", "detail", "none"],
    queryFn: () => getStudent(studentId as string),
    enabled: Boolean(studentId),
  });
}

/** See the note on `useOwnTeacherProfileQuery` — `enabled` keeps the shared
 * My-profile view from calling this for non-students. */
export function useOwnStudentProfileQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ownStudentQueryKey,
    queryFn: getOwnStudentProfile,
    retry: false,
    enabled,
  });
}

export function useCreateStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStudentPayload) => createStudent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", "list"] });
    },
  });
}

export function useUpdateStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, payload }: { studentId: string; payload: UpdateStudentPayload }) =>
      updateStudent(studentId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["students", "list"] });
      queryClient.invalidateQueries({ queryKey: studentQueryKey(variables.studentId) });
    },
  });
}

export function useSoftDeleteStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => softDeleteStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", "list"] });
    },
  });
}

export function useHardDeleteStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => hardDeleteStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", "list"] });
    },
  });
}

export function useLinkGuardianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      studentId,
      guardianId,
      relation,
      isPrimary,
    }: {
      studentId: string;
      guardianId: string;
      relation: string;
      isPrimary: boolean;
    }) => linkGuardianToStudent(studentId, guardianId, { relation, is_primary: isPrimary }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: studentQueryKey(variables.studentId) });
      queryClient.invalidateQueries({ queryKey: ["guardians", "detail", variables.guardianId] });
      queryClient.invalidateQueries({ queryKey: ownStudentQueryKey });
    },
  });
}

export function useUpdateGuardianLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      studentId,
      guardianId,
      relation,
      isPrimary,
    }: {
      studentId: string;
      guardianId: string;
      relation?: string;
      isPrimary?: boolean;
    }) => updateGuardianLink(studentId, guardianId, { relation, is_primary: isPrimary }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: studentQueryKey(variables.studentId) });
      queryClient.invalidateQueries({ queryKey: ["guardians", "detail", variables.guardianId] });
    },
  });
}

export function useUnlinkGuardianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, guardianId }: { studentId: string; guardianId: string }) =>
      unlinkGuardianFromStudent(studentId, guardianId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: studentQueryKey(variables.studentId) });
      queryClient.invalidateQueries({ queryKey: ["guardians", "detail", variables.guardianId] });
    },
  });
}
