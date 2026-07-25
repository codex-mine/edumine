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

export interface RegisterStudentPayload {
  full_name: string;
  email: string;
  phone: string;
  password: string;
}

export async function registerStudent(payload: RegisterStudentPayload): Promise<void> {
  await apiClient.post("/auth/register/student", payload);
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/reset-password", { token, new_password: newPassword });
}
