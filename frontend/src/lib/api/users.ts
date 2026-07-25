import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";
import type { EmploymentStatus } from "@/lib/api/teachers";

export type UserAccountRole = "admin" | "staff" | "accountant" | "receptionist";

export interface UserAccount {
  id: string;
  role: UserAccountRole;
  full_name: string;
  email: string | null;
  phone: string;
  gender: "male" | "female" | "other" | null;
  date_of_birth: string | null;
  is_active: boolean;
  created_at: string;
  employee_code: string | null;
  department: string | null;
  designation: string | null;
  joining_date: string | null;
  status: EmploymentStatus | null;
}

export interface CreateUserAccountPayload {
  role: UserAccountRole;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  employee_code?: string | null;
  department?: string | null;
  designation?: string | null;
  joining_date?: string | null;
}

export interface UpdateUserAccountPayload {
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  is_active?: boolean;
  department?: string | null;
  designation?: string | null;
  status?: EmploymentStatus;
}

export async function listUserAccounts(params: {
  page: number;
  limit: number;
  search?: string;
  role?: UserAccountRole;
}): Promise<{ items: UserAccount[]; meta: PageMeta }> {
  return getPaginated<UserAccount>("/users", params);
}

export async function getUserAccount(userId: string): Promise<UserAccount> {
  const { data } = await apiClient.get<UserAccount>(`/users/${userId}`);
  return data;
}

export async function getOwnUserAccount(): Promise<UserAccount> {
  const { data } = await apiClient.get<UserAccount>("/users/me");
  return data;
}

export async function createUserAccount(payload: CreateUserAccountPayload): Promise<UserAccount> {
  const { data } = await apiClient.post<UserAccount>("/users", payload);
  return data;
}

export async function updateUserAccount(userId: string, payload: UpdateUserAccountPayload): Promise<UserAccount> {
  const { data } = await apiClient.patch<UserAccount>(`/users/${userId}`, payload);
  return data;
}

export async function softDeleteUserAccount(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}`);
}

export async function hardDeleteUserAccount(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}/hard`);
}
