import Link from "next/link";

export default function Home() {
  return (
    <div className="flex justify-center items-center bg-zinc-50 dark:bg-black px-6 min-h-screen">
      <main className="flex flex-col items-center w-full max-w-2xl text-center">
        {/* Title */}
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-5xl tracking-tight">
          MemoAI
        </h1>

        {/* Subtitle */}
        <p className="mt-5 max-w-xl text-zinc-600 dark:text-zinc-400 text-lg">
          The intelligent flashcard app that helps you learn faster and remember
          longer. Just study — let AI handle the rest.
        </p>

        {/* CTA */}
        <Link
          href="/logsys/login"
          className="inline-flex justify-center items-center bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 mt-10 px-8 py-3 rounded-full font-medium text-white text-base transition"
        >
          Get Started
        </Link>
      </main>
    </div>
  );
}
