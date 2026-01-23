/**
 * Central API client for MemoAI
 * - Wraps fetch
 * - Normalises errors
 * - Keeps components clean
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { json, headers, ...rest } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;

  try {
    data = await res.json();
  } catch {
    // Non-JSON response (rare but safe to handle)
  }

  if (!res.ok) {
    throw new ApiError(
      data?.detail || data?.message || "Request failed",
      res.status,
    );
  }

  return data as T;
}
