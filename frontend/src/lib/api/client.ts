import axios from "axios";

export interface ApiSuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorDetail {
  field?: string;
  issue: string;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  error: {
    code: string;
    details: ApiErrorDetail[];
  };
}

export class ApiError extends Error {
  code: string;
  details: ApiErrorDetail[];

  constructor(envelope: ApiErrorEnvelope) {
    super(envelope.message);
    this.name = "ApiError";
    this.code = envelope.error.code;
    this.details = envelope.error.details;
  }
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Unwraps the standard { success, message, data } envelope so callers
// work directly with `data` via response.data.
apiClient.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiSuccessEnvelope<unknown>;
    response.data = envelope?.data;
    return response;
  },
  (error) => {
    const envelope = error.response?.data as ApiErrorEnvelope | undefined;
    if (envelope && envelope.success === false) {
      return Promise.reject(new ApiError(envelope));
    }
    return Promise.reject(error);
  }
);
