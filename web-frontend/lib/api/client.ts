// lib/api/client.ts

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { json, headers, ...rest } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include", // ✅ send session cookie
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // ignore non-JSON responses
  }

  if (!res.ok) {
    const maybeObj = data as { detail?: string; message?: string } | null;

    throw new ApiError(
      maybeObj?.detail || maybeObj?.message || "Request failed",
      res.status,
    );
  }

  return data as T;
}
