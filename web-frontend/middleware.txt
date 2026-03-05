// import { NextRequest, NextResponse } from "next/server";

// const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// export async function middleware(req: NextRequest) {
//   const { pathname, search } = req.nextUrl;

//   // lock down everything under /dashboard
//   if (!pathname.startsWith("/dashboard")) return NextResponse.next();

//   const cookie = req.headers.get("cookie") ?? "";

//   const res = await fetch(`${API_URL}/auth/me`, {
//     headers: { cookie }, // ✅ critical
//     credentials: "include",
//   });

//   if (res.ok) return NextResponse.next();

//   const loginUrl = req.nextUrl.clone();
//   loginUrl.pathname = "/logsys/login";
//   loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
//   return NextResponse.redirect(loginUrl);
// }

// export const config = {
//   matcher: ["/dashboard/:path*"],
// };
