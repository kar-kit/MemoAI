/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // trigger entrance animation after mount
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) return toast.error("Please enter your email.");
    if (!password) return toast.error("Please enter your password.");

    setIsSubmitting(true);

    try {
      const user = await login({
        email: email.trim(),
        password,
      });

      toast.success(`Welcome back, ${user.name}.`);
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) toast.error("Invalid email or password.");
        else if (err.status === 422)
          toast.error("Invalid input. Please check your details.");
        else toast.error(err.message || "Login failed.");
      } else if (err instanceof Error) {
        toast.error(err.message || "Something went wrong. Try again.");
      } else {
        toast.error("Something went wrong. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex justify-center items-center px-6 min-h-screen">
      {/* Background (no blobs, just a clean Apple-ish gradient + subtle noise feel via opacity) */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 dark:from-black via-white dark:via-zinc-950 to-zinc-100 dark:to-zinc-900 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />

      <div
        className={[
          "relative w-full max-w-sm rounded-2xl border bg-white/70 p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl",
          "dark:bg-zinc-950/60 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
          "border-zinc-200/70 dark:border-zinc-800/80",
          // entrance animation
          "transform-gpu transition-all duration-500 ease-out",
          mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        ].join(" ")}
      >
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-3xl text-center tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-sm text-center">
          Sign in to continue to <span className="font-medium">MemoAI</span>
        </p>

        <form className="space-y-5 mt-8" onSubmit={onSubmit}>
          <div className="group">
            <label className="block mb-1 font-medium text-zinc-700 dark:text-zinc-300 text-sm">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={[
                "w-full rounded-xl border bg-white/80 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400",
                "dark:bg-zinc-950/40 dark:text-zinc-50",
                "border-zinc-300/80 dark:border-zinc-700/70",
                "outline-none transition",
                "focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/15",
                "hover:border-zinc-400/90 dark:hover:border-zinc-600/90",
              ].join(" ")}
            />
          </div>

          <div className="group">
            <label className="block mb-1 font-medium text-zinc-700 dark:text-zinc-300 text-sm">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={[
                "w-full rounded-xl border bg-white/80 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400",
                "dark:bg-zinc-950/40 dark:text-zinc-50",
                "border-zinc-300/80 dark:border-zinc-700/70",
                "outline-none transition",
                "focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/15",
                "hover:border-zinc-400/90 dark:hover:border-zinc-600/90",
              ].join(" ")}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={[
              "mt-6 w-full rounded-full py-2.5 text-sm font-medium text-white",
              "bg-cyan-500",
              "shadow-[0_6px_16px_rgba(6,182,212,0.18)]",
              "transition-all duration-300 ease-out",
              "hover:bg-cyan-500/90 hover:shadow-[0_8px_18px_rgba(6,182,212,0.22)]",
              "active:translate-y-[1px] active:scale-[0.99]",
              "focus:outline-none focus:ring-4 focus:ring-cyan-500/20 dark:focus:ring-cyan-400/20",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
            ].join(" ")}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

          {/* Optional: tiny helper line that feels Apple-ish */}
          <p className="pt-1 text-zinc-500 dark:text-zinc-400 text-xs text-center">
            By signing in, you agree to continue to MemoAI.
          </p>
        </form>

        <p className="mt-6 text-zinc-500 dark:text-zinc-400 text-sm text-center">
          Don’t have an account?{" "}
          <a
            href="/logsys/register"
            className="font-medium text-cyan-600 hover:text-cyan-500 dark:hover:text-cyan-300 dark:text-cyan-400 hover:underline transition"
          >
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
