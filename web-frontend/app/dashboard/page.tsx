// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Arrow() {
  return (
    <span className="inline-flex items-center gap-1">
      <span>Open</span>
      <span className="transition-transform translate-x-0 group-hover:translate-x-0.5 duration-200">
        →
      </span>
    </span>
  );
}

function Card({
  title,
  description,
  href,
  badge,
  cta,
  variant = "primary",
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
  cta: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <div
      className={cx(
        "group relative overflow-hidden rounded-2xl border p-5 text-left",
        "bg-white/65 dark:bg-zinc-950/50 backdrop-blur-xl",
        "border-zinc-200/70 dark:border-zinc-800/80",
        "shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
      )}
    >
      {/* Indigo glow */}
      <div className="-top-24 -right-24 absolute bg-indigo-500/15 opacity-0 group-hover:opacity-100 blur-3xl rounded-full w-56 h-56 transition-opacity duration-500 pointer-events-none" />
      <div className="-bottom-24 -left-24 absolute bg-indigo-400/10 opacity-0 group-hover:opacity-100 blur-3xl rounded-full w-56 h-56 transition-opacity duration-500 pointer-events-none" />

      <div className="relative">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-base">
              {title}
            </h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm">
              {description}
            </p>
          </div>

          {badge ? (
            <div className="bg-indigo-500/10 px-2.5 py-1 border border-indigo-500/20 rounded-full font-semibold text-[11px] text-indigo-700 dark:text-indigo-300 shrink-0">
              {badge}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <Link
            href={href}
            className={cx(
              "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium",
              "focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
              "active:scale-[0.99] active:translate-y-[1px] transition-all duration-200",
              variant === "primary"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 text-white shadow-[0_10px_25px_rgba(79,70,229,0.22)] hover:shadow-[0_12px_28px_rgba(79,70,229,0.28)]"
                : "bg-white/80 hover:bg-white dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60 border border-zinc-300/80 hover:border-zinc-400/90 dark:border-zinc-700/70 dark:hover:border-zinc-600 text-zinc-900 dark:text-zinc-50",
            )}
          >
            <span className="group">{cta}</span>
          </Link>

          <div className="mt-3 text-zinc-500 dark:text-zinc-400 text-xs">
            <span className="inline-flex items-center gap-2">
              <span className="bg-indigo-400/80 rounded-full w-1.5 h-1.5" />
              <span className="dark:group-hover:text-zinc-300 group-hover:text-zinc-600 transition-colors">
                <Arrow />
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative px-6 min-h-screen overflow-hidden">
      {/* Backdrop (match your new indigo vibe) */}
      <div className="absolute inset-0 bg-zinc-50 dark:bg-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(99,102,241,0.18),transparent_60%),radial-gradient(900px_circle_at_20%_20%,rgba(129,140,248,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.12),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.10] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 dark:from-black/40 via-transparent to-zinc-50/70 dark:to-black/60 pointer-events-none" />

      <main
        className={cx(
          "relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center py-12",
          "transform-gpu transition-all duration-700 ease-out",
          mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 mx-auto px-3 py-1 border border-indigo-500/15 rounded-full font-semibold text-indigo-700 dark:text-indigo-300 text-xs">
            MemoAI Dashboard
          </div>

          <h1 className="mt-4 font-semibold text-zinc-900 dark:text-zinc-50 text-4xl md:text-5xl tracking-tight">
            Everything you need,
            <span className="text-indigo-600 dark:text-indigo-400">
              {" "}
              nothing you don’t.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-zinc-600 dark:text-zinc-400 text-base md:text-lg">
            Create and edit decks, study with spaced repetition, and chat with
            MemoAI to generate flashcards from your notes.
          </p>
        </div>

        {/* Primary actions */}
        <div className="gap-4 grid grid-cols-1 md:grid-cols-3 mt-10">
          <Card
            title="Create / Edit flashcards"
            description="Manage your decks, edit cards, and keep everything organised."
            href="/dashboard/decks"
            badge="Flashcards"
            cta="Open library"
            variant="primary"
          />

          <Card
            title="Study"
            description="Pick a deck and start reviewing. Keep sessions short and consistent."
            href="/flashcards"
            badge="Study"
            cta="Study now"
            variant="secondary"
          />

          <Card
            title="Chat with MemoAI"
            description="Ask questions, upload PDFs/PPTs, and generate decks in seconds."
            href="/dashboard/chat"
            badge="AI"
            cta="Open chat"
            variant="secondary"
          />
        </div>

        {/* Minimal footer */}
        <div className="mt-10 text-zinc-500 dark:text-zinc-400 text-xs text-center">
          Tip: 10 minutes daily beats cramming once a week.
        </div>
      </main>
    </div>
  );
}
