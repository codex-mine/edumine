import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";

export interface Guardian {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  gender: "male" | "female" | "other" | null;
  date_of_birth: string | null;
  profile_photo_url: string | null;
  is_active: boolean;
  occupation: string | null;
  address: string | null;
  created_at: string;
}

export interface LinkedStudentSummary {
  student_id: string;
  full_name: string;
  admission_number: string;
  relation: string;
  is_primary: boolean;
}

export interface GuardianDetail extends Guardian {
  students: LinkedStudentSummary[];
}

export interface CreateGuardianPayload {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  occupation?: string | null;
  address?: string | null;
}

export interface UpdateGuardianPayload {
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  is_active?: boolean;
  occupation?: string | null;
  address?: string | null;
}

export async function listGuardians(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ items: Guardian[]; meta: PageMeta }> {
  return getPaginated<Guardian>("/guardians", params);
}

export async function getGuardian(guardianId: string): Promise<GuardianDetail> {
  const { data } = await apiClient.get<GuardianDetail>(`/guardians/${guardianId}`);
  return data;
}

export async function getOwnGuardianProfile(): Promise<GuardianDetail> {
  const { data } = await apiClient.get<GuardianDetail>("/guardians/me");
  return data;
}

export async function createGuardian(payload: CreateGuardianPayload): Promise<Guardian> {
  const { data } = await apiClient.post<Guardian>("/guardians", payload);
  return data;
}

export async function updateGuardian(guardianId: string, payload: UpdateGuardianPayload): Promise<Guardian> {
  const { data } = await apiClient.patch<Guardian>(`/guardians/${guardianId}`, payload);
  return data;
}

export async function softDeleteGuardian(guardianId: string): Promise<void> {
  await apiClient.delete(`/guardians/${guardianId}`);
}

export async function hardDeleteGuardian(guardianId: string): Promise<void> {
  await apiClient.delete(`/guardians/${guardianId}/hard`);
}
