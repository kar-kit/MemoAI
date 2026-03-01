"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import Link from "next/link";
import { login } from "@/lib/api/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const user = await login({ email, password });
      toast.success(`Welcome back, ${user.name}.`);
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401)
        toast.error("Invalid email or password.");
      else toast.error("Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex justify-center items-center px-6 min-h-screen overflow-hidden">
      {/* Shared dashboard background */}
      <div className="absolute inset-0 bg-zinc-50 dark:bg-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_40%_-200px,rgba(99,102,241,0.18),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.10] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />

      <div
        className={`relative w-full max-w-sm rounded-2xl border bg-white/65 dark:bg-zinc-950/60 backdrop-blur-xl p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] border-zinc-200/70 dark:border-zinc-800/80 transform-gpu transition-all duration-500 ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-3xl text-center tracking-tight">
          Welcome back
        </h1>

        <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-sm text-center">
          Sign in to continue to <span className="font-medium">MemoAI</span>
        </p>

        <form className="space-y-5 mt-8" onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="Email"
            className="bg-white/80 dark:bg-zinc-950/40 px-4 py-2.5 border border-zinc-300/80 focus:border-indigo-500 dark:border-zinc-700/70 rounded-xl focus:ring-4 focus:ring-indigo-500/15 w-full text-sm transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="bg-white/80 dark:bg-zinc-950/40 px-4 py-2.5 border border-zinc-300/80 focus:border-indigo-500 dark:border-zinc-700/70 rounded-xl focus:ring-4 focus:ring-indigo-500/15 w-full text-sm transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            disabled={isSubmitting}
            className="bg-gradient-to-r from-indigo-600 hover:from-indigo-600 to-indigo-500 hover:to-indigo-400 shadow-[0_8px_20px_rgba(79,70,229,0.25)] py-2.5 rounded-full w-full font-medium text-white text-sm transition-all duration-300"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-zinc-500 dark:text-zinc-400 text-sm text-center">
          Don’t have an account?{" "}
          <Link
            href="/logsys/register"
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
