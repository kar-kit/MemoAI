// app/api/auth/logout/route.ts
//
// Proxy logout through Next.js so the session cookie is cleared on both
// the backend and the Vercel domain.

import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") ?? "";

  // Tell the backend to clear its session
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { cookie: cookieHeader },
  }).catch(() => null);

  const res = NextResponse.json({ ok: true });

  // Expire the session cookie on the Vercel domain
  res.headers.set(
    "set-cookie",
    "session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly"
  );

  return res;
}
