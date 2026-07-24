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
apiClient.interceptors.response.use((response) => {
  const envelope = response.data as ApiSuccessEnvelope<unknown>;
  response.data = envelope?.data;
  return response;
});

// Endpoints excluded from the silent-refresh-and-retry flow: retrying these
// would either loop (refresh itself) or retry a request that should just fail
// (login, logout).
const AUTH_ENDPOINTS = ["/auth/login", "/auth/refresh", "/auth/logout"];

let refreshPromise: Promise<void> | null = null;

function isAuthEndpoint(url: string | undefined): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => url?.includes(endpoint));
}

apiClient.interceptors.response.use(undefined, async (error) => {
  const envelope = error.response?.data as ApiErrorEnvelope | undefined;
  const config = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

  const isUnauthorized = error.response?.status === 401;
  const canRetry = config && !config._retried && !isAuthEndpoint(config.url);

  if (isUnauthorized && canRetry) {
    config._retried = true;
    try {
      refreshPromise ??= apiClient.post("/auth/refresh").then(
        () => undefined,
        (refreshError) => {
          throw refreshError;
        }
      );
      await refreshPromise;
      return apiClient.request(config);
    } catch {
      // Refresh failed — fall through to the normal error envelope below so
      // callers (e.g. the auth provider) can treat this as "logged out".
    } finally {
      refreshPromise = null;
    }
  }

  if (envelope && envelope.success === false) {
    return Promise.reject(new ApiError(envelope));
  }
  return Promise.reject(error);
});
