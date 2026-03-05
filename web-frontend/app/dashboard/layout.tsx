import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE = "/api/proxy";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieHeader = cookies().toString();

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    redirect(`/logsys/login?next=${encodeURIComponent("/dashboard")}`);
  }

  return <>{children}</>;
}
