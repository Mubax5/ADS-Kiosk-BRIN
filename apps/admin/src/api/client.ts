import type { ApiError } from "@ads-kiosk/shared";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiClientError("Server mengembalikan respons yang tidak valid", response.status, "INVALID_RESPONSE");
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  csrfToken: string | null = null,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }

  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const body = await parseJson(response);
  if (!response.ok) {
    const apiError = (body ?? {}) as Partial<ApiError>;
    throw new ApiClientError(
      apiError.message ?? `Permintaan gagal (${response.status})`,
      response.status,
      apiError.error ?? "REQUEST_FAILED",
      apiError.details,
    );
  }
  return body as T;
}

export const apiClient = {
  get<T>(path: string) {
    return apiRequest<T>(path);
  },
  post<T>(path: string, body: unknown, csrfToken: string | null = null) {
    return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) }, csrfToken);
  },
  put<T>(path: string, body: unknown, csrfToken: string | null = null) {
    return apiRequest<T>(path, { method: "PUT", body: JSON.stringify(body) }, csrfToken);
  },
  patch<T>(path: string, body: unknown, csrfToken: string | null = null) {
    return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }, csrfToken);
  },
  delete(path: string, csrfToken: string | null = null) {
    return apiRequest<null>(path, { method: "DELETE" }, csrfToken);
  },
};
