import { apiClient } from "@/lib/api/client";

export interface PendingStudent {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  admission_number: string;
  created_at: string;
}

export async function listPendingStudents(): Promise<PendingStudent[]> {
  const { data } = await apiClient.get<PendingStudent[]>("/students/pending");
  return data;
}

export async function activateStudent(userId: string): Promise<void> {
  await apiClient.post(`/students/${userId}/activate`);
}
