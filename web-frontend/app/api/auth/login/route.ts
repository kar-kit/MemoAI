// app/api/auth/login/route.ts
//
// Proxy the login request to FastAPI and re-stamp the session cookie onto the
// Vercel (frontend) domain. This is necessary because FastAPI sets the cookie
// on the API domain, but Next.js SSR runs on the Vercel domain — so without
// this proxy, server components can never read or forward the session cookie.

import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { detail: "Could not reach the backend" },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => null);

  const res = NextResponse.json(data, { status: backendRes.status });

  // Re-apply every Set-Cookie header from the backend onto this (Vercel) domain
  // so the browser stores the session cookie here and Next.js SSR can read it.
  backendRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      res.headers.append("set-cookie", value);
    }
  });

  return res;
}
