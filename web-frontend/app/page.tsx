import Link from "next/link";

export default function Home() {
  return (
    <div className="relative px-6 min-h-screen overflow-hidden">
      {/* Background — identical vibe to dashboard */}
      <div className="absolute inset-0 bg-zinc-50 dark:bg-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(99,102,241,0.18),transparent_60%),radial-gradient(900px_circle_at_20%_20%,rgba(129,140,248,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.12),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.10] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 dark:from-black/40 via-transparent to-zinc-50/70 dark:to-black/60 pointer-events-none" />

      <main className="relative flex flex-col justify-center mx-auto py-20 max-w-4xl min-h-screen text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 mx-auto px-3 py-1 border border-indigo-500/15 rounded-full font-semibold text-indigo-700 dark:text-indigo-300 text-xs">
          MemoAI
        </div>

        <h1 className="mt-6 font-semibold text-zinc-900 dark:text-zinc-50 text-5xl md:text-6xl tracking-tight">
          Learn faster.
          <span className="text-indigo-600 dark:text-indigo-400">
            {" "}
            Remember longer.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-zinc-600 dark:text-zinc-400 text-lg md:text-xl">
          AI-powered flashcards with built-in spaced repetition. Create decks
          from PDFs, notes, or chat — and study smarter.
        </p>

        <div className="flex justify-center gap-4 mt-10">
          <Link
            href="/logsys/register"
            className="inline-flex justify-center items-center bg-gradient-to-r from-indigo-600 hover:from-indigo-600 to-indigo-500 hover:to-indigo-400 shadow-[0_10px_25px_rgba(79,70,229,0.25)] hover:shadow-[0_14px_30px_rgba(79,70,229,0.30)] px-6 py-3 rounded-full font-medium text-white text-sm transition-all duration-300"
          >
            Get started
          </Link>

          <Link
            href="/logsys/login"
            className="inline-flex justify-center items-center bg-white/80 dark:bg-zinc-950/40 px-6 py-3 border border-zinc-300/80 hover:border-zinc-400 dark:border-zinc-700/70 dark:hover:border-zinc-600 rounded-full font-medium text-zinc-900 dark:text-zinc-50 text-sm transition"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-10 text-zinc-500 dark:text-zinc-400 text-xs">
          10 minutes daily beats cramming once a week.
        </p>
      </main>
    </div>
  );
}
