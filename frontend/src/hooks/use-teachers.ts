import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTeacher,
  getOwnTeacherProfile,
  getTeacher,
  hardDeleteTeacher,
  listTeachers,
  softDeleteTeacher,
  updateTeacher,
  type CreateTeacherPayload,
  type UpdateTeacherPayload,
} from "@/lib/api/teachers";

export const teachersQueryKey = (params: { page: number; limit: number; search?: string }) =>
  ["teachers", "list", params] as const;
export const teacherQueryKey = (id: string) => ["teachers", "detail", id] as const;
export const ownTeacherQueryKey = ["teachers", "me"] as const;

export function useTeachersQuery(params: { page: number; limit: number; search?: string }) {
  return useQuery({
    queryKey: teachersQueryKey(params),
    queryFn: () => listTeachers(params),
    placeholderData: (previous) => previous,
  });
}

export function useTeacherQuery(teacherId: string | null) {
  return useQuery({
    queryKey: teacherId ? teacherQueryKey(teacherId) : ["teachers", "detail", "none"],
    queryFn: () => getTeacher(teacherId as string),
    enabled: Boolean(teacherId),
  });
}

/** `enabled` lets a shared view (e.g. My profile) hold this back for roles that
 * have no teacher record, since the endpoint would only 404 for them. */
export function useOwnTeacherProfileQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ownTeacherQueryKey,
    queryFn: getOwnTeacherProfile,
    retry: false,
    enabled,
  });
}

export function useCreateTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTeacherPayload) => createTeacher(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "list"] });
    },
  });
}

export function useUpdateTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherId, payload }: { teacherId: string; payload: UpdateTeacherPayload }) =>
      updateTeacher(teacherId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "list"] });
      queryClient.invalidateQueries({ queryKey: teacherQueryKey(variables.teacherId) });
    },
  });
}

export function useSoftDeleteTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teacherId: string) => softDeleteTeacher(teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "list"] });
    },
  });
}

export function useHardDeleteTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teacherId: string) => hardDeleteTeacher(teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "list"] });
    },
  });
}
