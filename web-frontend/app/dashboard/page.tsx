"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  title,
  description,
  href,
  badge,
  cta,
  variant = "primary",
  size = "normal",
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
  cta: string;
  variant?: "primary" | "secondary" | "subtle";
  size?: "normal" | "compact";
}) {
  const isCompact = size === "compact";

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ease-out",
        isCompact ? "p-4" : "p-6",
        variant === "subtle"
          ? "bg-white/40 dark:bg-zinc-950/30"
          : "bg-white/65 dark:bg-zinc-950/50",
        "border-zinc-200/70 dark:border-zinc-800/80",
        !isCompact &&
          "hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
        !isCompact &&
          "shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
      )}
    >
      <div
        className={cx(
          isCompact
            ? "flex items-center justify-between gap-4"
            : "flex flex-col",
        )}
      >
        {/* Left side */}
        <div>
          <div className="flex justify-between items-start gap-3">
            <div>
              <h2
                className={cx(
                  "font-semibold text-zinc-900 dark:text-zinc-50",
                  isCompact ? "text-sm" : "text-base",
                )}
              >
                {title}
              </h2>

              <p
                className={cx(
                  "mt-1 text-zinc-600 dark:text-zinc-400",
                  isCompact ? "text-xs" : "text-sm",
                )}
              >
                {description}
              </p>
            </div>

            {!isCompact && badge && (
              <div className="bg-indigo-500/10 px-2.5 py-1 border border-indigo-500/20 rounded-full font-semibold text-[11px] text-indigo-700 dark:text-indigo-300 shrink-0">
                {badge}
              </div>
            )}
          </div>
        </div>

        {/* Button */}
        <div className={isCompact ? "" : "mt-5"}>
          <Link
            href={href}
            className={cx(
              "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
              isCompact ? "px-4 py-1.5 text-xs" : "px-5 py-2.5 text-sm",
              variant === "primary" &&
                "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 text-white shadow-[0_10px_25px_rgba(79,70,229,0.22)]",
              variant === "secondary" &&
                "bg-white/80 hover:bg-white dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60 border border-zinc-300/80 hover:border-zinc-400/90 dark:border-zinc-700/70 dark:hover:border-zinc-600 text-zinc-900 dark:text-zinc-50",
              variant === "subtle" &&
                "bg-transparent border border-zinc-300/60 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/40 dark:hover:bg-zinc-900/40",
            )}
          >
            {cta}
          </Link>
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
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-50 dark:bg-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(99,102,241,0.18),transparent_60%)] pointer-events-none" />
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
            Create and edit decks, and chat with MemoAI to generate flashcards
            from your notes.
          </p>
        </div>

        <div className="space-y-8 mt-12">
          {/* Survey — thinner + flatter */}
          <Card
            title="User Survey"
            description="Help improve MemoAI by completing a quick checklist-based survey."
            href="/dashboard/survey"
            badge="Feedback"
            cta="Open survey"
            variant="subtle"
            size="compact"
          />

          {/* Main buttons — larger */}
          <div className="gap-6 grid grid-cols-1 md:grid-cols-2">
            <Card
              title="Create / Edit flashcards"
              description="Manage your decks, edit cards, and keep everything organised."
              href="/dashboard/decks"
              badge="Flashcards"
              cta="Open library"
              variant="primary"
              size="normal"
            />

            <Card
              title="Chat with MemoAI"
              description="Ask questions, upload PDFs/PPTs, and generate decks in seconds."
              href="/dashboard/chat"
              badge="AI"
              cta="Open chat"
              variant="secondary"
              size="normal"
            />
          </div>
        </div>

        <div className="mt-12 text-zinc-500 dark:text-zinc-400 text-xs text-center">
          Tip: 10 minutes daily beats cramming once a week.
        </div>
      </main>
    </div>
  );
}
