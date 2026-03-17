/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/api/client.ts
//
// All client-side fetches are routed through the Next.js proxy (/api/proxy)
// so the session cookie (stored on the Vercel domain after login) is forwarded
// to FastAPI by the proxy server rather than by the browser directly.
const API_BASE_URL = "/api/proxy";

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

function formatFastApiDetail(detail: unknown): string | null {
  // FastAPI validation error often returns: { detail: [{ loc, msg, type }, ...] }
  if (Array.isArray(detail)) {
    const first = detail[0] as any;
    if (first?.msg) return String(first.msg);
    return "Validation error";
  }
  if (typeof detail === "string") return detail;
  return null;
}

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

  // Try JSON first, fallback to text
  let data: unknown = null;
  let text: string | null = null;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      text = await res.text();
      data = text;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    // FastAPI can return { detail: "..." } or { detail: [...] }
    const obj = (data && typeof data === "object" ? (data as any) : null) as {
      detail?: unknown;
      message?: unknown;
    } | null;

    const msgFromDetail = obj?.detail ? formatFastApiDetail(obj.detail) : null;
    const msgFromMessage =
      typeof obj?.message === "string" ? obj.message : null;

    const finalMessage =
      msgFromDetail ||
      msgFromMessage ||
      (typeof data === "string" ? data : null) ||
      "Request failed";

    throw new ApiError(finalMessage, res.status, data);
  }

  return data as T;
}
