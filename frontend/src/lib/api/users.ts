import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";
import type { Qualification, QualificationInput } from "@/lib/api/qualifications";
import type { EmploymentStatus } from "@/lib/api/teachers";

export type UserAccountRole = "admin" | "staff" | "accountant" | "receptionist";

export const STAFF_DESIGNATIONS = [
  "Accountant",
  "Receptionist",
  "Office Assistant",
  "Librarian",
  "Lab Assistant",
  "IT Support",
  "Security Guard",
  "Peon",
] as const;

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
  nid_number: string | null;
  nid_document_url: string | null;
  previous_employment: string | null;
  status: EmploymentStatus | null;
}

export interface UserAccountDetail extends UserAccount {
  qualifications: Qualification[];
}

export interface CreateUserAccountPayload {
  role: UserAccountRole;
  full_name: string;
  email: string;
  phone: string;
  password?: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  employee_code?: string | null;
  department?: string | null;
  designation?: string | null;
  joining_date?: string | null;
  nid_number?: string | null;
  nid_document_url?: string | null;
  previous_employment?: string | null;
  qualifications?: QualificationInput[];
}

export interface CreateUserAccountResult extends UserAccountDetail {
  temporary_password: string | null;
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
  nid_number?: string | null;
  nid_document_url?: string | null;
  previous_employment?: string | null;
  status?: EmploymentStatus;
  qualifications?: QualificationInput[];
}

export async function listUserAccounts(params: {
  page: number;
  limit: number;
  search?: string;
  role?: UserAccountRole;
}): Promise<{ items: UserAccount[]; meta: PageMeta }> {
  return getPaginated<UserAccount>("/users", params);
}

export async function getUserAccount(userId: string): Promise<UserAccountDetail> {
  const { data } = await apiClient.get<UserAccountDetail>(`/users/${userId}`);
  return data;
}

export async function getOwnUserAccount(): Promise<UserAccountDetail> {
  const { data } = await apiClient.get<UserAccountDetail>("/users/me");
  return data;
}

export async function createUserAccount(payload: CreateUserAccountPayload): Promise<CreateUserAccountResult> {
  const { data } = await apiClient.post<CreateUserAccountResult>("/users", payload);
  return data;
}

export async function updateUserAccount(userId: string, payload: UpdateUserAccountPayload): Promise<UserAccountDetail> {
  const { data } = await apiClient.patch<UserAccountDetail>(`/users/${userId}`, payload);
  return data;
}

export async function softDeleteUserAccount(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}`);
}

export async function hardDeleteUserAccount(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}/hard`);
}
