import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // These are cookies for your frontend domain only
  const cookieStore = cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    redirect(`/logsys/login?next=${encodeURIComponent("/dashboard")}`);
  }

  return <>{children}</>;
}
