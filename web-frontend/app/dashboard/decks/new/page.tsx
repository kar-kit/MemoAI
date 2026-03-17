// app/dashboard/decks/new/page.tsx
"use client";

import { useMemo, useState } from "react";

import BackButton from "../../_components/BackButton";
import { useRouter } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type DraftCard = {
  front: string;
  back: string;
};

function makeEmptyCard(): DraftCard {
  return { front: "", back: "" };
}

export default function NewDeckPage() {
  const router = useRouter();

  const API_URL = "/api/proxy";

  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<DraftCard[]>([
    makeEmptyCard(),
    makeEmptyCard(),
    makeEmptyCard(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validCards = useMemo(
    () =>
      cards.filter(
        (c) => c.front.trim().length > 0 && c.back.trim().length > 0,
      ),
    [cards],
  );

  function updateCard(index: number, patch: Partial<DraftCard>) {
    setCards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, ...patch } : card)),
    );
  }

  function addCard() {
    setCards((prev) => [...prev, makeEmptyCard()]);
  }

  function removeCard(index: number) {
    setCards((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim() || "Untitled deck";

    if (validCards.length === 0) {
      setError("Add at least one complete card before saving.");
      return;
    }

    setIsSubmitting(true);

    try {
      const deckRes = await fetch(`${API_URL}/decks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          source_type: "text", // ✅ fix: backend accepts this
          source_ref: null,
          tags: [],
        }),
      });

      if (!deckRes.ok) {
        const txt = await deckRes.text().catch(() => "");
        throw new Error(`Failed to create deck (${deckRes.status}) ${txt}`);
      }

      const deckData = (await deckRes.json()) as { deck_id: string };
      const deckId = deckData.deck_id;

      const cardsRes = await fetch(`${API_URL}/decks/${deckId}/cards`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          validCards.map((c) => ({
            front: c.front.trim(),
            back: c.back.trim(),
          })),
        ),
      });

      if (!cardsRes.ok) {
        const txt = await cardsRes.text().catch(() => "");
        throw new Error(`Failed to add cards (${cardsRes.status}) ${txt}`);
      }

      router.push(`/dashboard/decks/`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative px-6 min-h-screen overflow-hidden text-[var(--app-fg)]">
      {/* Shared indigo dashboard background */}
      <div className="absolute inset-0 bg-zinc-50 dark:bg-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(99,102,241,0.18),transparent_60%),radial-gradient(900px_circle_at_20%_20%,rgba(129,140,248,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.12),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.10] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 dark:from-black/40 via-transparent to-zinc-50/70 dark:to-black/60 pointer-events-none" />

      <main className="relative mx-auto py-10 max-w-5xl">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="text-zinc-500 dark:text-zinc-400 text-xs">
              Library / Flashcards / New
            </div>
            <h1 className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50 text-3xl tracking-tight">
              Create a new deck
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400 text-sm">
              Build a flashcard deck manually by giving it a title and writing
              your own cards.
            </p>
          </div>

          <BackButton label="Back" />
        </div>

        <form onSubmit={onSubmit} className="space-y-6 mt-8">
          <div className="bg-white/65 dark:bg-zinc-950/50 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl p-6 border border-zinc-200/70 dark:border-zinc-800/80 rounded-3xl">
            <label className="block font-semibold text-zinc-500 dark:text-zinc-400 text-xs tracking-wide">
              DECK TITLE
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems Week 4"
              className="bg-white/80 dark:bg-zinc-950/40 mt-2 px-4 py-3 border border-zinc-300/80 focus:border-indigo-500 dark:border-zinc-700/70 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/15 w-full text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 text-sm transition"
            />
          </div>

          <div className="bg-white/65 dark:bg-zinc-950/50 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl p-6 border border-zinc-200/70 dark:border-zinc-800/80 rounded-3xl">
            <div className="flex justify-between items-center gap-3">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-xl">
                  Cards
                </h2>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm">
                  Only cards with both a front and back will be saved.
                </p>
              </div>

              <button
                type="button"
                onClick={addCard}
                className="bg-white/80 hover:bg-white dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60 px-4 py-2 border border-zinc-300/80 dark:border-zinc-700/70 rounded-xl font-medium text-zinc-900 dark:text-zinc-50 text-sm transition"
              >
                + Add card
              </button>
            </div>

            <div className="space-y-4 mt-6">
              {cards.map((card, index) => (
                <div
                  key={index}
                  className="bg-zinc-50/80 dark:bg-zinc-950/40 p-4 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl"
                >
                  <div className="flex justify-between items-center gap-3 mb-3">
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm">
                      Card {index + 1}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCard(index)}
                      disabled={cards.length === 1}
                      className={cx(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        cards.length === 1
                          ? "cursor-not-allowed bg-rose-100 text-rose-300 dark:bg-rose-500/10 dark:text-rose-300/40"
                          : "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-200",
                      )}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="gap-4 grid md:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-[11px] text-zinc-500 dark:text-zinc-400 tracking-wide">
                        FRONT
                      </label>
                      <textarea
                        rows={4}
                        value={card.front}
                        onChange={(e) =>
                          updateCard(index, { front: e.target.value })
                        }
                        placeholder="Type the question…"
                        className="bg-white dark:bg-zinc-950/50 mt-2 px-3 py-3 border border-zinc-300/80 focus:border-indigo-500 dark:border-zinc-700/70 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/15 w-full text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 text-sm transition resize-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[11px] text-zinc-500 dark:text-zinc-400 tracking-wide">
                        BACK
                      </label>
                      <textarea
                        rows={4}
                        value={card.back}
                        onChange={(e) =>
                          updateCard(index, { back: e.target.value })
                        }
                        placeholder="Type the answer…"
                        className="bg-white dark:bg-zinc-950/50 mt-2 px-3 py-3 border border-zinc-300/80 focus:border-indigo-500 dark:border-zinc-700/70 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/15 w-full text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 text-sm transition resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error ? (
              <div className="bg-rose-50 dark:bg-rose-500/10 mt-5 px-4 py-3 border border-rose-300/60 dark:border-rose-400/20 rounded-xl text-rose-700 dark:text-rose-200 text-sm">
                {error}
              </div>
            ) : null}

            <div className="flex justify-between items-center gap-4 mt-6">
              <div className="text-zinc-500 dark:text-zinc-400 text-xs">
                {validCards.length} complete card
                {validCards.length === 1 ? "" : "s"} ready to save
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={cx(
                  "rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98]",
                  isSubmitting
                    ? "cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    : "bg-indigo-600 text-white hover:bg-indigo-500",
                )}
              >
                {isSubmitting ? "Creating deck..." : "Create deck"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
