"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex justify-center items-center px-6 min-h-screen">
      {/* Background (match login/register) */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 dark:from-black via-white dark:via-zinc-950 to-zinc-100 dark:to-zinc-900 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />

      <main
        className={[
          "relative w-full max-w-3xl rounded-2xl border bg-white/70 p-8 text-center backdrop-blur-xl",
          "shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
          "border-zinc-200/70 dark:border-zinc-800/80 dark:bg-zinc-950/60",
          "transform-gpu transition-all duration-500 ease-out",
          mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        ].join(" ")}
      >
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-4xl tracking-tight">
          Dashboard
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400 text-lg">
          Manage your flashcards, generate new sets, and track your study
          progress.
        </p>

        {/* Quick actions */}
        {/* Quick actions */}
        <div className="gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {/* Create flashcards */}
          <div className="bg-white/60 hover:bg-white/70 dark:bg-zinc-950/40 dark:hover:bg-zinc-950/55 p-5 border border-zinc-200/70 hover:border-zinc-300/80 dark:border-zinc-800/80 dark:hover:border-zinc-700 rounded-2xl text-left transition">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-base">
              Create flashcards
            </h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm">
              Start a new set and let MemoAI generate cards for you.
            </p>
            <Link
              href="/flashcards/create"
              className="inline-flex items-center bg-cyan-500 hover:bg-cyan-500/90 shadow-[0_6px_16px_rgba(6,182,212,0.18)] hover:shadow-[0_8px_18px_rgba(6,182,212,0.22)] mt-4 px-4 py-2 rounded-full focus:outline-none focus:ring-4 focus:ring-cyan-500/20 dark:focus:ring-cyan-400/20 font-medium text-white text-sm active:scale-[0.99] transition-all active:translate-y-[1px] duration-300 ease-out"
            >
              New set
            </Link>
          </div>

          {/* Study now */}
          <div className="bg-white/60 hover:bg-white/70 dark:bg-zinc-950/40 dark:hover:bg-zinc-950/55 p-5 border border-zinc-200/70 hover:border-zinc-300/80 dark:border-zinc-800/80 dark:hover:border-zinc-700 rounded-2xl text-left transition">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-base">
              Study now
            </h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm">
              Review a saved deck and keep your streak going.
            </p>
            <Link
              href="/flashcards"
              className="inline-flex items-center bg-white/80 hover:bg-white dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60 mt-4 px-4 py-2 border border-zinc-300/80 hover:border-zinc-400/90 dark:border-zinc-700/70 dark:hover:border-zinc-600 rounded-full focus:outline-none focus:ring-4 focus:ring-cyan-500/15 dark:focus:ring-cyan-400/15 font-medium text-zinc-900 dark:text-zinc-50 text-sm transition"
            >
              Browse decks
            </Link>
          </div>

          {/* Chat */}
          <div className="bg-white/60 hover:bg-white/70 dark:bg-zinc-950/40 dark:hover:bg-zinc-950/55 p-5 border border-zinc-200/70 hover:border-zinc-300/80 dark:border-zinc-800/80 dark:hover:border-zinc-700 rounded-2xl text-left transition">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-base">
              Chat with MemoAI
            </h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm">
              Ask questions, explore ideas, or start a fresh conversation.
            </p>
            <Link
              href="/dashboard/chat"
              className="inline-flex items-center bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 mt-4 px-4 py-2 rounded-full focus:outline-none focus:ring-4 focus:ring-zinc-500/20 dark:focus:ring-zinc-400/20 font-medium text-white dark:text-zinc-900 text-sm active:scale-[0.99] transition"
            >
              New chat
            </Link>
          </div>
        </div>

        {/* Optional subtle footer line */}
        <p className="mt-8 text-zinc-500 dark:text-zinc-400 text-xs">
          Tip: Keep sessions short — consistency beats cramming.
        </p>
      </main>
    </div>
  );
}
