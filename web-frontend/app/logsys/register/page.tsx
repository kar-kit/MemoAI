"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { register } from "@/lib/api/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function Register() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const inputClass =
    "bg-white/80 dark:bg-zinc-950/40 px-4 py-2.5 border border-zinc-300/80 " +
    "dark:border-zinc-700/70 rounded-xl w-full text-sm transition outline-none " +
    "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 " +
    "text-zinc-900 dark:text-zinc-50 placeholder-zinc-400";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ✅ FRONTEND ONLY ACCESS CODE CHECK
    if (accessCode.trim() !== "HongKong2005") {
      toast.error("Invalid access code.");
      return;
    }

    try {
      await register({ name, email, password });
      toast.success("Account created.");
      router.push("/logsys/login");
    } catch {
      toast.error("Registration failed.");
    }
  }

  return (
    <div className="relative flex justify-center items-center px-6 min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-zinc-50 dark:bg-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_40%_-200px,rgba(99,102,241,0.18),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.10] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />

      <div
        className={`relative w-full max-w-sm rounded-2xl border border-zinc-200/70 bg-white/65 p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl transform-gpu transition-all duration-500 dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-3xl text-center tracking-tight">
          Create account
        </h1>

        <form className="space-y-5 mt-8" onSubmit={onSubmit}>
          <input
            placeholder="Name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />

          <input
            placeholder="Email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          {/* 🔐 Access Code Field */}
          <div className="relative">
            <input
              type="password"
              placeholder="Access code"
              className={inputClass + " pr-10"}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              autoComplete="off"
            />

            {/* Info Icon + tooltip */}
            <div className="group right-3 absolute inset-y-0 flex items-center">
              <button
                type="button"
                className="place-items-center grid hover:bg-white/60 dark:hover:bg-zinc-950/50 rounded-full w-7 h-7 text-zinc-400 hover:text-indigo-500 transition"
                aria-label="Where do I find the access code?"
              >
                ⓘ
              </button>

              <div className="right-0 bottom-full absolute bg-zinc-950/90 opacity-0 group-hover:opacity-100 shadow-lg mb-2 px-3 py-2 border border-white/10 rounded-xl w-56 text-zinc-100 text-xs transition-opacity pointer-events-none">
                The access code is provided separately by the researcher during
                study participation.
              </div>
            </div>
          </div>

          <button className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:to-indigo-400 shadow-[0_8px_20px_rgba(79,70,229,0.25)] py-2.5 rounded-full w-full font-medium text-white text-sm transition-all duration-300">
            Create account
          </button>
        </form>

        <p className="mt-6 text-zinc-500 dark:text-zinc-400 text-sm text-center">
          Already have an account?{" "}
          <Link
            href="/logsys/login"
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
