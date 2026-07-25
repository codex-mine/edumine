import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";

export type EmploymentStatus = "active" | "on_leave" | "resigned" | "terminated";

export interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  gender: "male" | "female" | "other" | null;
  date_of_birth: string | null;
  is_active: boolean;
  employee_code: string;
  joining_date: string;
  designation: string | null;
  qualification: string | null;
  status: EmploymentStatus;
  created_at: string;
}

export interface CreateTeacherPayload {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  employee_code?: string | null;
  joining_date: string;
  designation?: string | null;
  qualification?: string | null;
}

export interface UpdateTeacherPayload {
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  is_active?: boolean;
  designation?: string | null;
  qualification?: string | null;
  status?: EmploymentStatus;
}

export async function listTeachers(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ items: Teacher[]; meta: PageMeta }> {
  return getPaginated<Teacher>("/teachers", params);
}

export async function getTeacher(teacherId: string): Promise<Teacher> {
  const { data } = await apiClient.get<Teacher>(`/teachers/${teacherId}`);
  return data;
}

export async function getOwnTeacherProfile(): Promise<Teacher> {
  const { data } = await apiClient.get<Teacher>("/teachers/me");
  return data;
}

export async function createTeacher(payload: CreateTeacherPayload): Promise<Teacher> {
  const { data } = await apiClient.post<Teacher>("/teachers", payload);
  return data;
}

export async function updateTeacher(teacherId: string, payload: UpdateTeacherPayload): Promise<Teacher> {
  const { data } = await apiClient.patch<Teacher>(`/teachers/${teacherId}`, payload);
  return data;
}

export async function softDeleteTeacher(teacherId: string): Promise<void> {
  await apiClient.delete(`/teachers/${teacherId}`);
}

export async function hardDeleteTeacher(teacherId: string): Promise<void> {
  await apiClient.delete(`/teachers/${teacherId}/hard`);
}
