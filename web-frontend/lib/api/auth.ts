// lib/api/auth.ts
import { ApiError, apiFetch } from "./client";

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type RegisterResponse = {
  id: string;
  uid: string;
  name: string;
  email: string;
};

export async function register(payload: RegisterPayload) {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    json: payload,
  });
}

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  id: string;
  uid: string;
  name: string;
  email: string;
};

/**
 * Login via the Next.js proxy route (/api/auth/login) instead of calling
 * FastAPI directly. The proxy re-stamps the session cookie onto the Vercel
 * domain so that Next.js SSR pages can read and forward it.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    const message =
      typeof detail === "string" ? detail : "Invalid email or password";
    throw new ApiError(message, res.status, data);
  }

  return data as LoginResponse;
}

/**
 * Logout via the Next.js proxy route so the cookie is cleared on the
 * Vercel domain as well as on the backend.
 */
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
}
