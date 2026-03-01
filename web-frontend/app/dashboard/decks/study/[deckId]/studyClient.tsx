// app/dashboard/decks/study/[deckId]/studyClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

type Deck = { deck_id: string; title: string };
type Rating = 1 | 2 | 3 | 4 | 5;

type Card = {
  card_id: string;
  deck_id: string;
  front: string;
  back: string;
  last_rating?: Rating | null; // ✅ from backend
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ratingClasses(n: Rating) {
  switch (n) {
    case 1:
      return "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/15";
    case 2:
      return "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/15";
    case 3:
      return "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/15";
    case 4:
      return "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15";
    case 5:
      return "border-green-200 bg-green-50 text-green-900 hover:bg-green-100 dark:border-green-500/25 dark:bg-green-500/10 dark:text-green-200 dark:hover:bg-green-500/15";
  }
}

/**
 * Border color for the big card container based on last_rating.
 * Keep it subtle (still looks “card-y”), but clearly coloured.
 */
function cardBorderByRating(r?: Rating | null) {
  switch (r) {
    case 1:
      return "border-red-300/80 dark:border-red-500/40";
    case 2:
      return "border-orange-300/80 dark:border-orange-500/40";
    case 3:
      return "border-amber-300/80 dark:border-amber-500/40";
    case 4:
      return "border-emerald-300/80 dark:border-emerald-500/40";
    case 5:
      return "border-green-300/80 dark:border-green-500/40";
    default:
      return "border-zinc-200/70 dark:border-zinc-800/80";
  }
}

/**
 * Makes the previously-used rating look “selected”.
 */
function selectedRingByRating(r: Rating) {
  switch (r) {
    case 1:
      return "ring-red-400/30 dark:ring-red-400/25";
    case 2:
      return "ring-orange-400/30 dark:ring-orange-400/25";
    case 3:
      return "ring-amber-400/30 dark:ring-amber-400/25";
    case 4:
      return "ring-emerald-400/30 dark:ring-emerald-400/25";
    case 5:
      return "ring-green-400/30 dark:ring-green-400/25";
  }
}

export default function StudyClient({ deck }: { deck: Deck }) {
  const API_URL = useMemo(
    () =>
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
      "http://localhost:8000",
    [],
  );

  const [card, setCard] = useState<Card | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [isRating, setIsRating] = useState(false);

  const fetchNext = useCallback(
    async (opts?: { cancelled?: () => boolean }) => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/decks/${deck.deck_id}/study/next`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch next card");
        const data = await res.json();

        if (opts?.cancelled?.()) return;

        if (!data.card) {
          setFinished(true);
          setCard(null);
          setRemaining(0);
        } else {
          setFinished(false);
          setCard(data.card);
          setRemaining(data.remaining ?? 0);
        }

        setShowBack(false);
      } finally {
        if (!opts?.cancelled?.()) setLoading(false);
      }
    },
    [API_URL, deck.deck_id],
  );

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card || isRating) return;
      setIsRating(true);

      try {
        await fetch(
          `${API_URL}/decks/${deck.deck_id}/study/${card.card_id}/rate`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating }),
          },
        );
        await fetchNext();
      } finally {
        setIsRating(false);
      }
    },
    [API_URL, deck.deck_id, card, fetchNext, isRating],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchNext({ cancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [fetchNext]);

  const cardBorder = cardBorderByRating(card?.last_rating ?? null);

  return (
    <div className="relative bg-[var(--app-bg)] px-6 min-h-screen overflow-hidden text-[var(--app-fg)]">
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_40%_-200px,rgba(99,102,241,0.18),transparent_60%)] dark:bg-[radial-gradient(900px_circle_at_40%_-200px,rgba(99,102,241,0.25),transparent_60%)] pointer-events-none" />

      <main className="relative mx-auto py-10 max-w-3xl">
        <div className="flex justify-between items-center gap-3">
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-2xl truncate">
            {deck.title}
          </h1>
          <Link
            href="/dashboard/decks"
            className="text-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-200 dark:text-indigo-300 text-sm shrink-0"
          >
            Back to library
          </Link>
        </div>

        <div
          className={cx(
            "bg-white/70 dark:bg-zinc-950/50 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur mt-8 p-6 border rounded-2xl transition-colors",
            cardBorder,
          )}
        >
          {loading ? (
            <div className="text-zinc-600 dark:text-zinc-400 text-sm">
              Loading...
            </div>
          ) : finished ? (
            <div className="text-center animate-in duration-300 fade-in">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-xl">
                Session complete 🎉
              </h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm">
                No more cards to review.
              </p>
            </div>
          ) : card ? (
            <>
              <div className="text-zinc-500 dark:text-zinc-400 text-xs">
                {remaining + 1} remaining
              </div>

              <div className="slide-in-from-bottom-1 mt-4 font-semibold text-zinc-900 dark:text-zinc-50 text-xl whitespace-pre-wrap animate-in duration-300 fade-in">
                {card.front}
              </div>

              {!showBack ? (
                <button
                  onClick={() => setShowBack(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 mt-6 px-4 py-2 rounded-full font-medium text-white text-sm motion-reduce:transform-none active:scale-[0.98] transition"
                >
                  Show answer
                </button>
              ) : (
                <div className="slide-in-from-bottom-2 animate-in duration-200 fade-in">
                  <div className="mt-6 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                    {card.back}
                  </div>

                  <div className="mt-6">
                    <div className="text-zinc-500 dark:text-zinc-400 text-xs">
                      Rate how well you knew it
                    </div>

                    <div className="gap-2 grid grid-cols-5 mt-2">
                      {([1, 2, 3, 4, 5] as Rating[]).map((n) => {
                        const isSelected =
                          card.last_rating != null && card.last_rating === n;

                        return (
                          <button
                            key={n}
                            onClick={() => rate(n)}
                            disabled={isRating}
                            className={cx(
                              "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                              "active:scale-[0.98] motion-reduce:transform-none",
                              "focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400/40",
                              isRating && "opacity-70 cursor-not-allowed",
                              ratingClasses(n),
                              isSelected &&
                                cx(
                                  "ring-4 ring-inset border-transparent",
                                  selectedRingByRating(n),
                                ),
                            )}
                            title={
                              n === 1
                                ? "Forgot"
                                : n === 2
                                  ? "Hard"
                                  : n === 3
                                    ? "Okay"
                                    : n === 4
                                      ? "Good"
                                      : "Easy"
                            }
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2 text-zinc-500 dark:text-zinc-400 text-xs">
                      1 = forgot • 5 = easy
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
