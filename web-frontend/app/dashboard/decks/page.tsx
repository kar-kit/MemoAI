import BackButton from "./../_components/BackButton";
// app/dashboard/decks/page.tsx
import DeckGrid from "./_components/DeckGrid";
import Link from "next/link";
import { cookies } from "next/headers";

export type DeckListItem = {
  deck_id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
  source_type?: string;
  card_count: number;
  mastery_score?: number;
};

async function getDecks(): Promise<DeckListItem[]> {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:8000";

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${API_URL}/decks?limit=200`, {
    method: "GET",
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to load decks (${res.status}) ${txt}`);
  }

  return (await res.json()) as DeckListItem[];
}

export default async function FlashcardsPage() {
  const decks = await getDecks();
  const isEmpty = decks.length === 0;

  return (
    <div className="relative bg-[var(--app-bg)] min-h-screen overflow-hidden text-[var(--app-fg)]">
      {/* Theme-aware backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_30%_-200px,rgba(99,102,241,0.18),transparent_60%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.12),transparent_55%),radial-gradient(700px_circle_at_15%_60%,rgba(56,189,248,0.08),transparent_60%)] dark:bg-[radial-gradient(1100px_circle_at_30%_-200px,rgba(99,102,241,0.30),transparent_60%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.22),transparent_55%),radial-gradient(700px_circle_at_15%_60%,rgba(56,189,248,0.10),transparent_60%)] pointer-events-none" />

      <div className="absolute inset-0 opacity-[0.10] pointer-events-none [background-image:radial-gradient(rgba(0,0,0,0.18)_1px,transparent_1px)] dark:[background-image:radial-gradient(rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:18px_18px]" />

      <div className="absolute inset-0 bg-gradient-to-b from-black/[0.02] dark:from-black/10 via-black/[0.04] dark:via-black/30 to-black/[0.08] dark:to-black/80 pointer-events-none" />

      <div className="z-10 relative mx-auto px-6 py-10 max-w-6xl">
        {/* Header row */}
        <div className="flex sm:flex-row flex-col sm:justify-between sm:items-start gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-[var(--app-muted)] text-xs">
              Library / Flashcards
            </div>
            <h1 className="font-semibold text-3xl tracking-tight">
              Your decks
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/decks/new"
              className="inline-flex justify-center items-center bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-semibold text-white text-sm active:scale-[0.98] transition"
            >
              + New deck
            </Link>

            <BackButton label="Back" />
          </div>
        </div>

        <div className="mt-8">
          {isEmpty ? (
            <div className="bg-[var(--card-bg)] shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl p-8 border border-[var(--card-border)] rounded-3xl text-center">
              <h2 className="font-semibold text-xl">No decks yet</h2>

              <p className="mx-auto mt-2 max-w-md text-[var(--app-muted)] text-sm">
                Generate flashcards instantly by chatting with MemoAI, or create
                your first deck manually.
              </p>

              <div className="flex justify-center gap-4 mt-6">
                <a
                  href="/dashboard/chat"
                  className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-xl font-semibold text-white text-sm active:scale-[0.98] transition"
                >
                  Chat with MemoAI
                </a>

                <Link
                  href="/dashboard/decks/new"
                  className="bg-black/[0.04] hover:bg-black/[0.06] dark:bg-white/10 dark:hover:bg-white/15 px-5 py-2 border border-[var(--card-border)] rounded-xl font-semibold text-sm active:scale-[0.98] transition"
                >
                  Create manually
                </Link>
              </div>

              <p className="mt-4 text-[var(--app-muted)] text-xs">
                Tip: Paste notes or upload PDFs in chat to auto-generate a deck.
              </p>
            </div>
          ) : (
            <>
              <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 mb-6">
                <p className="text-[var(--app-muted)] text-sm">
                  {decks.length} deck{decks.length === 1 ? "" : "s"}
                </p>

                <Link
                  href="/dashboard/decks/new"
                  className="inline-flex justify-center items-center bg-black/[0.04] hover:bg-black/[0.06] dark:bg-white/10 dark:hover:bg-white/15 px-4 py-2 border border-[var(--card-border)] rounded-xl font-semibold text-sm active:scale-[0.98] transition"
                >
                  Create manually
                </Link>
              </div>

              <DeckGrid decks={decks} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
