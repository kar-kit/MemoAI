import { NextRequest, NextResponse } from "next/server";

const ORIGIN = process.env.BACKEND_ORIGIN!; // e.g. https://memo.jp-homelab.work

export async function GET(
  req: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(req, ctx.params.path);
}
export async function POST(
  req: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(req, ctx.params.path);
}
export async function PUT(
  req: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(req, ctx.params.path);
}
export async function PATCH(
  req: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(req, ctx.params.path);
}
export async function DELETE(
  req: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(req, ctx.params.path);
}

async function forward(req: NextRequest, path: string[]) {
  const url = new URL(req.url);
  const target = new URL(`${ORIGIN}/${path.join("/")}`);
  target.search = url.search;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const body = ["GET", "HEAD"].includes(req.method)
    ? undefined
    : await req.arrayBuffer();

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  // Important: pass Set-Cookie back to browser (now set for Vercel domain)
  const resHeaders = new Headers(upstream.headers);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}
