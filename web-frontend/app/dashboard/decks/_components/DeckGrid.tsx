"use client";

import { useMemo, useState } from "react";

import type { DeckListItem } from "../page";
import Link from "next/link";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}

type SortMode = "updated" | "title" | "most_cards" | "least_cards";
type CountFilter = "all" | "empty" | "nonempty";

export default function DeckGrid({ decks }: { decks: DeckListItem[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [countFilter, setCountFilter] = useState<CountFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of decks) {
      if (d.source_type) set.add(d.source_type);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [decks]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    let base = decks;

    // search
    if (query) {
      base = base.filter((d) => (d.title || "").toLowerCase().includes(query));
    }

    // source filter
    if (sourceFilter !== "all") {
      base = base.filter((d) => (d.source_type || "unknown") === sourceFilter);
    }

    // empty/non-empty filter
    if (countFilter === "empty")
      base = base.filter((d) => (d.card_count ?? 0) === 0);
    if (countFilter === "nonempty")
      base = base.filter((d) => (d.card_count ?? 0) > 0);

    // sort
    const sorted = [...base].sort((a, b) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");

      if (sort === "most_cards")
        return (b.card_count ?? 0) - (a.card_count ?? 0);
      if (sort === "least_cards")
        return (a.card_count ?? 0) - (b.card_count ?? 0);

      // updated default
      const ad = new Date(a.updated_at || a.created_at || 0).getTime();
      const bd = new Date(b.updated_at || b.created_at || 0).getTime();
      return bd - ad;
    });

    return sorted;
  }, [decks, q, sort, countFilter, sourceFilter]);

  return (
    <div className="bg-white/[0.04] shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl p-5 border border-white/10 rounded-3xl">
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
                "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35",
                "focus:border-indigo-400/30 focus:ring-4 focus:ring-indigo-500/15",
              )}
            />
            <div className="top-1/2 right-3 absolute text-white/35 -translate-y-1/2 pointer-events-none">
              ⌘K
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Count filter */}
            <div className="inline-flex bg-white/5 p-1 rounded-full ring-1 ring-white/10">
              {(["all", "nonempty", "empty"] as CountFilter[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCountFilter(mode)}
                  className={cx(
                    "rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.98]",
                    countFilter === mode
                      ? "bg-indigo-500/25 text-white"
                      : "text-white/60 hover:text-white/85",
                  )}
                >
                  {mode === "all"
                    ? "All"
                    : mode === "nonempty"
                      ? "With cards"
                      : "Empty"}
                </button>
              ))}
            </div>

            {/* Source filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className={cx(
                "rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/80 outline-none",
                "focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400/30",
              )}
            >
              {sourceOptions.map((s) => (
                <option key={s} value={s} className="bg-[#0B1020]">
                  {s === "all" ? "All sources" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className={cx(
              "rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/80 outline-none",
              "focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400/30",
            )}
          >
            <option value="updated" className="bg-[#0B1020]">
              Recently updated
            </option>
            <option value="title" className="bg-[#0B1020]">
              Title
            </option>
            <option value="most_cards" className="bg-[#0B1020]">
              Most cards
            </option>
            <option value="least_cards" className="bg-[#0B1020]">
              Least cards
            </option>
          </select>

          <div className="hidden md:block bg-white/5 px-3 py-2 rounded-full ring-1 ring-white/10 font-semibold text-[11px] text-white/55">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="gap-4 grid sm:grid-cols-2 lg:grid-cols-3 mt-5">
        {filtered.map((d, idx) => (
          <div
            key={d.deck_id}
            className="slide-in-from-bottom-2 animate-in duration-300 fade-in"
            style={{ animationDelay: `${Math.min(idx * 30, 220)}ms` }}
          >
            <div className="group bg-black/20 hover:bg-white/[0.06] p-5 border border-white/10 hover:border-white/15 rounded-3xl h-full transition">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-white/95 text-sm truncate">
                    {d.title || "Untitled deck"}
                  </div>
                  <div className="mt-1 text-white/50 text-xs">
                    Updated {formatDate(d.updated_at || d.created_at)}
                    {d.source_type ? ` • ${d.source_type}` : ""}
                  </div>
                </div>

                <div className="bg-indigo-500/15 px-3 py-1 rounded-full ring-1 ring-indigo-400/20 font-semibold text-[10px] text-indigo-200">
                  {d.card_count ?? 0} cards
                </div>
              </div>

              <div className="flex justify-between items-center gap-2 mt-4">
                <Link
                  href={`/dashboard/decks/${d.deck_id}`}
                  className="inline-flex justify-center items-center bg-indigo-500 hover:bg-indigo-400 px-3 py-2 rounded-xl font-semibold text-white text-xs active:scale-[0.98] transition"
                >
                  Edit
                </Link>

                <div className="text-[11px] text-white/45">
                  {d.card_count === 0 ? "Empty deck" : "Ready to study"}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 bg-black/20 p-6 border border-white/10 rounded-3xl text-white/60 text-sm">
            No decks found.
          </div>
        )}
      </div>
    </div>
  );
}
