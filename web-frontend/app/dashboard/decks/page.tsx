import DeckGrid from "./_components/DeckGrid";
// app/flashcards/page.tsx
import { cookies } from "next/headers";

export type DeckListItem = {
  deck_id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
  source_type?: string;
  card_count: number;
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

  return (
    <div className="relative bg-[#070A12] min-h-screen overflow-hidden text-white">
      {/* Indigo backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_30%_-200px,rgba(99,102,241,0.30),transparent_60%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.22),transparent_55%),radial-gradient(700px_circle_at_15%_60%,rgba(56,189,248,0.10),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.10] pointer-events-none [background-image:radial-gradient(rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/80 pointer-events-none" />

      <div className="z-10 relative mx-auto px-6 py-10 max-w-6xl">
        <div className="flex flex-col gap-2">
          <div className="text-white/45 text-xs">Library / Flashcards</div>
          <h1 className="font-semibold text-3xl tracking-tight">Your decks</h1>
          <p className="text-white/55 text-sm">
            {decks.length} deck{decks.length === 1 ? "" : "s"} · click edit to
            open the card editor
          </p>
        </div>

        <div className="mt-8">
          <DeckGrid decks={decks} />
        </div>
      </div>
    </div>
  );
}
