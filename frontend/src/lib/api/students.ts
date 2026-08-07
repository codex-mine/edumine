import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";

export interface PendingStudent {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  admission_number: string;
  created_at: string;
}

export type StudentStatus = "active" | "transferred" | "graduated" | "dropped";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export interface Student {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  gender: "male" | "female" | "other" | null;
  date_of_birth: string | null;
  profile_photo_url: string | null;
  is_active: boolean;
  admission_number: string;
  admission_date: string;
  blood_group: string | null;
  address: string | null;
  emergency_contact: string | null;
  status: StudentStatus;
  created_at: string;
  class_name: string | null;
  section_name: string | null;
  roll_number: string | null;
}

export interface LinkedGuardianSummary {
  guardian_id: string;
  full_name: string;
  phone: string;
  relation: string;
  is_primary: boolean;
}

export interface StudentDetail extends Student {
  guardians: LinkedGuardianSummary[];
}

export interface CreateStudentPayload {
  full_name: string;
  email?: string | null;
  phone: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth: string;
  section_id: string;
  admission_date?: string | null;
  blood_group?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
}

export interface AdmitStudentResult extends Student {
  temporary_password: string;
  academic_year_name: string;
}

export interface UpdateStudentPayload {
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  is_active?: boolean;
  blood_group?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  status?: StudentStatus;
}

export async function listPendingStudents(): Promise<PendingStudent[]> {
  const { data } = await apiClient.get<PendingStudent[]>("/students/pending");
  return data;
}

export async function activateStudent(userId: string): Promise<void> {
  await apiClient.post(`/students/${userId}/activate`);
}

export async function listStudents(params: {
  page: number;
  limit: number;
  search?: string;
  status?: StudentStatus;
}): Promise<{ items: Student[]; meta: PageMeta }> {
  return getPaginated<Student>("/students", params);
}

export async function getStudent(studentId: string): Promise<StudentDetail> {
  const { data } = await apiClient.get<StudentDetail>(`/students/${studentId}`);
  return data;
}

export async function getOwnStudentProfile(): Promise<StudentDetail> {
  const { data } = await apiClient.get<StudentDetail>("/students/me");
  return data;
}

export async function createStudent(payload: CreateStudentPayload): Promise<AdmitStudentResult> {
  const { data } = await apiClient.post<AdmitStudentResult>("/students", payload);
  return data;
}

export async function updateStudent(studentId: string, payload: UpdateStudentPayload): Promise<Student> {
  const { data } = await apiClient.patch<Student>(`/students/${studentId}`, payload);
  return data;
}

export async function softDeleteStudent(studentId: string): Promise<void> {
  await apiClient.delete(`/students/${studentId}`);
}

export async function hardDeleteStudent(studentId: string): Promise<void> {
  await apiClient.delete(`/students/${studentId}/hard`);
}

export async function linkGuardianToStudent(
  studentId: string,
  guardianId: string,
  payload: { relation: string; is_primary: boolean }
): Promise<void> {
  await apiClient.post(`/students/${studentId}/guardians/${guardianId}`, payload);
}

export async function updateGuardianLink(
  studentId: string,
  guardianId: string,
  payload: { relation?: string; is_primary?: boolean }
): Promise<void> {
  await apiClient.patch(`/students/${studentId}/guardians/${guardianId}`, payload);
}

export async function unlinkGuardianFromStudent(studentId: string, guardianId: string): Promise<void> {
  await apiClient.delete(`/students/${studentId}/guardians/${guardianId}`);
}
