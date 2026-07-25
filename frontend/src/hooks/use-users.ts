import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createUserAccount,
  getOwnUserAccount,
  getUserAccount,
  hardDeleteUserAccount,
  listUserAccounts,
  softDeleteUserAccount,
  updateUserAccount,
  type CreateUserAccountPayload,
  type UpdateUserAccountPayload,
  type UserAccountRole,
} from "@/lib/api/users";

export const userAccountsQueryKey = (params: { page: number; limit: number; search?: string; role?: UserAccountRole }) =>
  ["users", "list", params] as const;
export const userAccountQueryKey = (id: string) => ["users", "detail", id] as const;
export const ownUserAccountQueryKey = ["users", "me"] as const;

export function useUserAccountsQuery(params: { page: number; limit: number; search?: string; role?: UserAccountRole }) {
  return useQuery({
    queryKey: userAccountsQueryKey(params),
    queryFn: () => listUserAccounts(params),
    placeholderData: (previous) => previous,
  });
}

export function useUserAccountQuery(userId: string | null) {
  return useQuery({
    queryKey: userId ? userAccountQueryKey(userId) : ["users", "detail", "none"],
    queryFn: () => getUserAccount(userId as string),
    enabled: Boolean(userId),
  });
}

export function useOwnUserAccountQuery() {
  return useQuery({
    queryKey: ownUserAccountQueryKey,
    queryFn: getOwnUserAccount,
    retry: false,
  });
}

export function useCreateUserAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserAccountPayload) => createUserAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}

export function useUpdateUserAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserAccountPayload }) =>
      updateUserAccount(userId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      queryClient.invalidateQueries({ queryKey: userAccountQueryKey(variables.userId) });
    },
  });
}

export function useSoftDeleteUserAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => softDeleteUserAccount(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}

export function useHardDeleteUserAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => hardDeleteUserAccount(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}
