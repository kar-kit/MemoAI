// app/dashboard/chat/_components/DeckCreatedCard.tsx
"use client";

import type { DeckCreatedAction } from "../_types/chat";
import Link from "next/link";

export default function DeckCreatedCard({
  action,
}: {
  action: DeckCreatedAction;
}) {
  return (
    <div className="bg-white/70 dark:bg-zinc-950/60 mt-3 p-4 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm truncate">
            {action.title}
          </div>
          <div className="mt-0.5 text-zinc-600 dark:text-zinc-400 text-xs">
            {action.card_count} cards • Deck created
          </div>
        </div>

        <Link
          href={`/flashcards/${action.deck_id}`}
          className="inline-flex items-center bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 px-3 py-1.5 rounded-full font-medium text-white dark:text-zinc-900 text-xs transition shrink-0"
        >
          Open
        </Link>
      </div>

      {action.preview_cards?.length ? (
        <div className="space-y-2 mt-3">
          {action.preview_cards.slice(0, 3).map((c, i) => (
            <div
              key={`${action.deck_id}-${i}`}
              className="bg-white/60 dark:bg-zinc-900/40 p-3 border border-zinc-200/70 dark:border-zinc-800/80 rounded-xl"
            >
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Q
              </div>
              <div className="mt-0.5 text-zinc-900 dark:text-zinc-50 text-sm whitespace-pre-wrap">
                {c.front}
              </div>

              <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                A
              </div>
              <div className="mt-0.5 text-zinc-700 dark:text-zinc-200 text-sm whitespace-pre-wrap">
                {c.back}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
