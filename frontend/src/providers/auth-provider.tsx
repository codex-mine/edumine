"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";

import type { AuthenticatedUser, LoginPayload } from "@/lib/api/auth";
import { loginErrorMessage, useCurrentUserQuery, useLoginMutation, useLogoutMutation } from "@/hooks/use-auth";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthenticatedUser>;
  isLoggingIn: boolean;
  loginError: string | null;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUserQuery();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading,
      login: (payload) => loginMutation.mutateAsync(payload),
      isLoggingIn: loginMutation.isPending,
      loginError: loginMutation.error ? loginErrorMessage(loginMutation.error) : null,
      logout: async () => {
        await logoutMutation.mutateAsync();
        queryClient.clear();
      },
      isLoggingOut: logoutMutation.isPending,
    }),
    [user, isLoading, loginMutation, logoutMutation, queryClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
