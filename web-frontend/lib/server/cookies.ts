// lib/server/cookies.ts
// Server-only utility — do NOT import in client components.
import { cookies } from "next/headers";

/**
 * Builds a `Cookie` header string from the current request's cookies so that
 * server-side fetch calls to the FastAPI backend forward the session cookie.
 *
 * Using getAll() is more reliable than toString() across Next.js versions
 * because it always produces a properly URL-encoded `name=value` pair format.
 */
export async function forwardCookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}
