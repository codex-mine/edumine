import { apiClient } from "@/lib/api/client";

export interface UploadedFile {
  url: string;
  filename: string;
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<UploadedFile>("/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
