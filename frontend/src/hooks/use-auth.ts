import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  registerStudent,
  resetPassword,
  type LoginPayload,
  type RegisterStudentPayload,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export const authQueryKey = ["auth", "me"] as const;

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKey, user);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      queryClient.setQueryData(authQueryKey, null);
    },
  });
}

export function useRegisterStudentMutation() {
  return useMutation({
    mutationFn: (payload: RegisterStudentPayload) => registerStudent(payload),
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (email: string) => forgotPassword(email),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      resetPassword(token, newPassword),
  });
}

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unable to log in. Please try again.";
}
