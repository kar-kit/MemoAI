import { NextRequest, NextResponse } from "next/server";

const ORIGIN = process.env.BACKEND_ORIGIN!; // e.g. https://memo.jp-homelab.work

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}

async function forward(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;

  const url = new URL(req.url);
  const target = new URL(`${ORIGIN}/${path.join("/")}`);
  target.search = url.search;

  // Forward headers (including Cookie)
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

  // Return upstream response 그대로, including Set-Cookie
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
