"use client";

import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { register } from "@/lib/api/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function Register() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const passwordsMatch = useMemo(() => {
    if (!password || !confirmPassword) return true;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return toast.error("Please enter your name.");
    if (!email.trim()) return toast.error("Please enter your email.");
    if (password.length < 8)
      return toast.error("Password must be at least 8 characters.");
    if (!passwordsMatch) return toast.error("Passwords don’t match.");

    setIsSubmitting(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      toast.success("Account created. You can sign in now.");
      router.push("/logsys/login");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409)
          toast.error("That email is already registered.");
        else if (err.status === 422)
          toast.error("Invalid input. Please check your details.");
        else toast.error(err.message || "Registration failed.");
      } else if (err instanceof Error) {
        toast.error(err.message || "Something went wrong. Try again.");
      } else {
        toast.error("Something went wrong. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border bg-white/80 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 " +
    "dark:bg-zinc-950/40 dark:text-zinc-50 " +
    "border-zinc-300/80 dark:border-zinc-700/70 " +
    "outline-none transition " +
    "hover:border-zinc-400/90 dark:hover:border-zinc-600/90 " +
    "focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 " +
    "dark:focus:border-cyan-400 dark:focus:ring-cyan-400/15";

  return (
    <div className="relative flex justify-center items-center px-6 min-h-screen">
      {/* Background (match login) */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 dark:from-black via-white dark:via-zinc-950 to-zinc-100 dark:to-zinc-900 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />

      {/* Card (match login) */}
      <div
        className={[
          "relative w-full max-w-sm rounded-2xl border bg-white/70 p-8 backdrop-blur-xl",
          "shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
          "border-zinc-200/70 dark:border-zinc-800/80 dark:bg-zinc-950/60",
          "transform-gpu transition-all duration-500 ease-out",
          mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        ].join(" ")}
      >
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-3xl text-center tracking-tight">
          Create account
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-sm text-center">
          Join <span className="font-medium">MemoAI</span> in under a minute.
        </p>

        <form className="space-y-5 mt-8" onSubmit={onSubmit}>
          <div>
            <label className="block mb-1 font-medium text-zinc-700 dark:text-zinc-300 text-sm">
              Name
            </label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Joey Pang"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block mb-1 font-medium text-zinc-700 dark:text-zinc-300 text-sm">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block mb-1 font-medium text-zinc-700 dark:text-zinc-300 text-sm">
              Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
            <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-xs">
              Use 8+ characters for better security.
            </p>
          </div>

          <div>
            <label className="block mb-1 font-medium text-zinc-700 dark:text-zinc-300 text-sm">
              Confirm password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={[
                "w-full rounded-xl border bg-white/80 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition",
                "dark:bg-zinc-950/40 dark:text-zinc-50",
                passwordsMatch
                  ? "border-zinc-300/80 hover:border-zinc-400/90 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 dark:border-zinc-700/70 dark:hover:border-zinc-600/90 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/15"
                  : "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/15 dark:border-red-500 dark:focus:border-red-400 dark:focus:ring-red-400/15",
              ].join(" ")}
            />
            {!passwordsMatch && (
              <p className="mt-1 text-red-500 text-xs">
                Passwords don’t match.
              </p>
            )}
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
            {isSubmitting ? "Creating..." : "Create account"}
          </button>

          <p className="pt-1 text-zinc-500 dark:text-zinc-400 text-xs text-center">
            By creating an account, you agree to continue to MemoAI.
          </p>
        </form>

        <p className="mt-6 text-zinc-500 dark:text-zinc-400 text-sm text-center">
          Already have an account?{" "}
          <a
            href="/logsys/login"
            className="font-medium text-cyan-600 hover:text-cyan-500 dark:hover:text-cyan-300 dark:text-cyan-400 hover:underline transition"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
