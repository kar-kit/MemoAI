"use client";

import { useMemo, useState } from "react";

import type { DeckListItem } from "../page";
import Link from "next/link";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ✅ Deterministic (prevents SSR/client hydration mismatch)
// Format: DD/MM/YYYY in UTC
function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";

  const day = String(dt.getUTCDate()).padStart(2, "0");
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const year = dt.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

type SortMode = "updated" | "title" | "most_cards" | "least_cards" | "mastery";

export default function DeckGrid({ decks }: { decks: DeckListItem[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [onlyWithCards, setOnlyWithCards] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of decks) if (d.source_type) set.add(d.source_type);
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [decks]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let base = decks;

    if (query) {
      base = base.filter((d) => (d.title || "").toLowerCase().includes(query));
    }

    if (onlyWithCards) {
      base = base.filter((d) => (d.card_count ?? 0) > 0);
    }

    if (sourceFilter !== "all") {
      base = base.filter((d) => (d.source_type || "unknown") === sourceFilter);
    }

    const sorted = [...base].sort((a, b) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      if (sort === "most_cards")
        return (b.card_count ?? 0) - (a.card_count ?? 0);
      if (sort === "least_cards")
        return (a.card_count ?? 0) - (b.card_count ?? 0);
      if (sort === "mastery")
        return (a.mastery_score ?? 0) - (b.mastery_score ?? 0); // lowest first

      const ad = new Date(a.updated_at || a.created_at || 0).getTime();
      const bd = new Date(b.updated_at || b.created_at || 0).getTime();
      return bd - ad;
    });

    return sorted;
  }, [decks, q, sort, onlyWithCards, sourceFilter]);

  return (
    <div
      className={cx(
        "rounded-3xl border p-5 backdrop-blur-xl",
        "bg-[var(--card-bg)] border-[var(--card-border)]",
        "shadow-[0_18px_60px_rgba(0,0,0,0.10)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)]",
      )}
    >
      {/* Toolbar */}
      <div className="flex lg:flex-row flex-col lg:justify-between lg:items-center gap-3">
        <div className="flex md:flex-row flex-col flex-1 md:items-center gap-3">
          <div className="relative w-full md:max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search decks…"
              className={cx(
                "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
                "bg-black/[0.03] dark:bg-white/[0.04]",
                "border-[var(--card-border)]",
                "text-[var(--app-fg)] placeholder:text-[var(--app-muted)]/70",
                "focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400/40",
              )}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOnlyWithCards((v) => !v)}
              className={cx(
                "rounded-full px-3 py-2 text-[11px] font-semibold transition",
                "ring-1 ring-[var(--card-border)]",
                onlyWithCards
                  ? "bg-indigo-500/20 text-indigo-900 dark:text-indigo-100"
                  : "bg-black/[0.03] dark:bg-white/[0.04] text-[var(--app-muted)] hover:text-[var(--app-fg)]",
              )}
            >
              {onlyWithCards ? "Showing: With cards" : "Filter: With cards"}
            </button>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className={cx(
                "rounded-full border px-3 py-2 text-[11px] font-semibold outline-none transition",
                "bg-black/[0.03] dark:bg-white/[0.04]",
                "border-[var(--card-border)]",
                "text-[var(--app-muted)] focus:text-[var(--app-fg)]",
                "focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400/40",
              )}
            >
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All sources" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className={cx(
              "rounded-full border px-3 py-2 text-[11px] font-semibold outline-none transition",
              "bg-black/[0.03] dark:bg-white/[0.04]",
              "border-[var(--card-border)]",
              "text-[var(--app-muted)] focus:text-[var(--app-fg)]",
              "focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400/40",
            )}
          >
            <option value="updated">Recently updated</option>
            <option value="mastery">Lowest mastery first</option>
            <option value="title">Title</option>
            <option value="most_cards">Most cards</option>
            <option value="least_cards">Least cards</option>
          </select>

          <div className="hidden md:block bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2 rounded-full ring-[var(--card-border)] ring-1 font-semibold text-[11px] text-[var(--app-muted)]">
            {filtered.length} deck{filtered.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="gap-4 grid sm:grid-cols-2 lg:grid-cols-3 mt-5">
        {filtered.map((d) => {
          const cards = d.card_count ?? 0;
          const mastery = Math.max(0, Math.min(100, d.mastery_score ?? 0));
          const canStudy = cards > 0;

          const hint = !canStudy
            ? "Add cards to study"
            : mastery < 60
              ? "Needs review"
              : "In good shape";

          return (
            <div key={d.deck_id} className="animate-in duration-200 fade-in">
              <div
                className={cx(
                  "rounded-3xl border p-5 h-full transition",
                  "bg-black/[0.02] hover:bg-black/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
                  "border-[var(--card-border)] hover:border-black/20 dark:hover:border-white/20",
                )}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--app-fg)] text-sm truncate">
                      {d.title || "Untitled deck"}
                    </div>
                    <div className="mt-1 text-[var(--app-muted)] text-xs">
                      Updated {formatDate(d.updated_at || d.created_at)}
                      {d.source_type ? ` • ${d.source_type}` : ""}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-semibold text-[11px] text-[var(--app-muted)]">
                      {cards} cards
                    </div>
                    <div className="text-[10px] text-[var(--app-muted)]/80">
                      {hint}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between items-center text-[10px] text-[var(--app-muted)]">
                    <span>Mastery</span>
                    <span>{mastery}%</span>
                  </div>
                  <div className="bg-black/10 dark:bg-white/10 mt-1 rounded-full w-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 rounded-full h-full transition-[width] duration-500"
                      style={{ width: `${mastery}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center mt-5">
                  <Link
                    href={`/dashboard/decks/study/${d.deck_id}`}
                    className={cx(
                      "inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold transition active:scale-[0.98]",
                      canStudy
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                        : "pointer-events-none opacity-50 bg-black/10 dark:bg-white/10 text-[var(--app-muted)]",
                    )}
                    aria-disabled={!canStudy}
                    title={
                      !canStudy ? "Add cards before studying" : "Start studying"
                    }
                  >
                    Study
                  </Link>

                  <Link
                    href={`/dashboard/decks/${d.deck_id}`}
                    className="font-semibold text-[var(--app-muted)] hover:text-[var(--app-fg)] text-xs transition"
                  >
                    Edit →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 bg-black/[0.02] dark:bg-white/[0.03] p-6 border border-[var(--card-border)] rounded-3xl text-[var(--app-muted)] text-sm">
            No decks found.
          </div>
        )}
      </div>
    </div>
  );
}
