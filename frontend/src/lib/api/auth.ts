import { apiClient } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";

export interface AuthenticatedUser {
  id: string;
  full_name: string;
  role: Role;
  email: string | null;
  phone: string;
  permissions: string[];
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export async function login(payload: LoginPayload): Promise<AuthenticatedUser> {
  const { data } = await apiClient.post<AuthenticatedUser>("/auth/login", payload);
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function refreshSession(): Promise<AuthenticatedUser> {
  const { data } = await apiClient.post<AuthenticatedUser>("/auth/refresh");
  return data;
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const { data } = await apiClient.get<AuthenticatedUser>("/auth/me");
  return data;
}
