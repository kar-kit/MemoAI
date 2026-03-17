// lib/server/cookies.ts
// Server-only utility — do NOT import in client components.
import { headers } from "next/headers";

/**
 * Returns the raw `Cookie` header exactly as the browser sent it to Next.js,
 * so server-side fetches to the FastAPI backend forward the session token
 * without any re-encoding that could corrupt the Starlette session value.
 */
export async function forwardCookieHeader(): Promise<string> {
  const h = await headers();
  return h.get("cookie") ?? "";
}
