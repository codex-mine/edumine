import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createGuardian,
  getGuardian,
  getOwnGuardianProfile,
  hardDeleteGuardian,
  listGuardians,
  softDeleteGuardian,
  updateGuardian,
  type CreateGuardianPayload,
  type UpdateGuardianPayload,
} from "@/lib/api/guardians";

export const guardiansQueryKey = (params: { page: number; limit: number; search?: string }) =>
  ["guardians", "list", params] as const;
export const guardianQueryKey = (id: string) => ["guardians", "detail", id] as const;
export const ownGuardianQueryKey = ["guardians", "me"] as const;

export function useGuardiansQuery(params: { page: number; limit: number; search?: string }) {
  return useQuery({
    queryKey: guardiansQueryKey(params),
    queryFn: () => listGuardians(params),
    placeholderData: (previous) => previous,
  });
}

export function useGuardianQuery(guardianId: string | null) {
  return useQuery({
    queryKey: guardianId ? guardianQueryKey(guardianId) : ["guardians", "detail", "none"],
    queryFn: () => getGuardian(guardianId as string),
    enabled: Boolean(guardianId),
  });
}

/** See the note on `useOwnTeacherProfileQuery` — `enabled` keeps the shared
 * My-profile view from calling this for non-guardians. */
export function useOwnGuardianProfileQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ownGuardianQueryKey,
    queryFn: getOwnGuardianProfile,
    retry: false,
    enabled,
  });
}

export function useCreateGuardianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGuardianPayload) => createGuardian(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians", "list"] });
    },
  });
}

export function useUpdateGuardianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guardianId, payload }: { guardianId: string; payload: UpdateGuardianPayload }) =>
      updateGuardian(guardianId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["guardians", "list"] });
      queryClient.invalidateQueries({ queryKey: guardianQueryKey(variables.guardianId) });
    },
  });
}

export function useSoftDeleteGuardianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guardianId: string) => softDeleteGuardian(guardianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians", "list"] });
    },
  });
}

export function useHardDeleteGuardianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guardianId: string) => hardDeleteGuardian(guardianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians", "list"] });
    },
  });
}
