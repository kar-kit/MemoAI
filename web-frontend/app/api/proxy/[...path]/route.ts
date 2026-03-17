// app/api/proxy/[...path]/route.ts
//
// Catch-all proxy that forwards every client-side API request to FastAPI,
// injecting the session cookie from the Vercel domain.
//
// This is necessary because after login the session cookie lives on the Vercel
// domain. Clients cannot send it directly to the FastAPI domain (different
// origin), so all browser → backend traffic is routed through here instead.
//
// Handles regular JSON, multipart file uploads, and SSE streaming responses.

import { NextRequest } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  const targetUrl = `${API_URL}/${path.join("/")}${req.nextUrl.search}`;

  // Forward headers the backend cares about
  const forwardHeaders: Record<string, string> = {
    cookie: req.headers.get("cookie") ?? "",
  };
  const contentType = req.headers.get("content-type");
  if (contentType) forwardHeaders["content-type"] = contentType;
  const accept = req.headers.get("accept");
  if (accept) forwardHeaders["accept"] = accept;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  const backendRes = await fetch(targetUrl, {
    method: req.method,
    headers: forwardHeaders,
    body: hasBody ? req.body : null,
    // Required by Node.js fetch to allow a streaming request body
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    duplex: hasBody ? "half" : undefined,
  });

  // Build response headers — preserve content-type and re-apply Set-Cookie
  const resHeaders = new Headers();
  const resContentType = backendRes.headers.get("content-type");
  if (resContentType) resHeaders.set("content-type", resContentType);

  backendRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      resHeaders.append("set-cookie", value);
    }
  });

  // Stream the body straight through — works for JSON, SSE, and file uploads
  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: resHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
