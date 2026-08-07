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

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

export const apiClient = axios.create({
  // Relative by default: requests go to this app's own origin and are forwarded
  // to the API by the rewrite in next.config.ts, so the auth cookies stay
  // first-party. Point NEXT_PUBLIC_API_BASE_URL at an absolute URL only if you
  // accept that cross-origin cookies will not reach proxy.ts.
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Unwraps the standard { success, message, data } envelope so callers
// work directly with `data` via response.data. `meta` (pagination) is kept
// on the response object itself since `data` for list endpoints is the bare array.
apiClient.interceptors.response.use((response) => {
  const envelope = response.data as ApiSuccessEnvelope<unknown>;
  const meta = envelope?.meta as PageMeta | undefined;
  response.data = envelope?.data;
  if (meta) {
    (response as typeof response & { meta?: PageMeta }).meta = meta;
  }
  return response;
});

/** Fetches a paginated list endpoint, pairing the unwrapped items with the envelope's `meta`. */
export async function getPaginated<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<{ items: T[]; meta: PageMeta }> {
  const response = await apiClient.get<T[]>(url, { params });
  const meta = (response as typeof response & { meta?: PageMeta }).meta ?? {
    page: 1,
    limit: response.data.length,
    total: response.data.length,
  };
  return { items: response.data, meta };
}

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
