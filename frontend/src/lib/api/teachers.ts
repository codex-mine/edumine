import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";
import type { Qualification, QualificationInput } from "@/lib/api/qualifications";

export type EmploymentStatus = "active" | "on_leave" | "resigned" | "terminated";

export const TEACHER_DESIGNATIONS = [
  "Head Teacher",
  "Assistant Head Teacher",
  "Senior Teacher",
  "Assistant Teacher",
  "Subject Teacher",
  "Physical Education Teacher",
  "Librarian Teacher",
  "Vice Principal",
] as const;

export interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  gender: "male" | "female" | "other" | null;
  date_of_birth: string | null;
  profile_photo_url: string | null;
  is_active: boolean;
  employee_code: string;
  joining_date: string;
  designation: string | null;
  qualification: string | null;
  nid_number: string | null;
  nid_document_url: string | null;
  previous_employment: string | null;
  status: EmploymentStatus;
  created_at: string;
}

export interface TeacherDetail extends Teacher {
  qualifications: Qualification[];
}

export interface CreateTeacherPayload {
  full_name: string;
  email: string;
  phone: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth: string;
  employee_code?: string | null;
  joining_date: string;
  designation?: string | null;
  qualification?: string | null;
  nid_number?: string | null;
  nid_document_url?: string | null;
  previous_employment?: string | null;
  qualifications?: QualificationInput[];
}

export interface CreateTeacherResult extends TeacherDetail {
  temporary_password: string;
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
  nid_number?: string | null;
  nid_document_url?: string | null;
  previous_employment?: string | null;
  status?: EmploymentStatus;
  qualifications?: QualificationInput[];
}

export async function listTeachers(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ items: Teacher[]; meta: PageMeta }> {
  return getPaginated<Teacher>("/teachers", params);
}

export async function getTeacher(teacherId: string): Promise<TeacherDetail> {
  const { data } = await apiClient.get<TeacherDetail>(`/teachers/${teacherId}`);
  return data;
}

export async function getOwnTeacherProfile(): Promise<TeacherDetail> {
  const { data } = await apiClient.get<TeacherDetail>("/teachers/me");
  return data;
}

export async function createTeacher(payload: CreateTeacherPayload): Promise<CreateTeacherResult> {
  const { data } = await apiClient.post<CreateTeacherResult>("/teachers", payload);
  return data;
}

export async function updateTeacher(teacherId: string, payload: UpdateTeacherPayload): Promise<TeacherDetail> {
  const { data } = await apiClient.patch<TeacherDetail>(`/teachers/${teacherId}`, payload);
  return data;
}

export async function softDeleteTeacher(teacherId: string): Promise<void> {
  await apiClient.delete(`/teachers/${teacherId}`);
}

export async function hardDeleteTeacher(teacherId: string): Promise<void> {
  await apiClient.delete(`/teachers/${teacherId}/hard`);
}
