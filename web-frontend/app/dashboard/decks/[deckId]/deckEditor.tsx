"use client";

import { useMemo, useState } from "react";

type Deck = {
  deck_id: string;
  title: string;
  description?: string | null;
};

type Card = {
  card_id: string;
  deck_id: string;
  front: string;
  back: string;
};

type EditableCard = Card & {
  _dirty?: boolean;
  _saving?: boolean;
  _deleting?: boolean;
  _error?: string | null;
  _isTemp?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function tempId() {
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function StatusPill({
  tone,
  children,
}: {
  tone: "indigo" | "zinc" | "amber" | "green" | "red";
  children: React.ReactNode;
}) {
  const tones: Record<typeof tone, string> = {
    indigo:
      "bg-indigo-500/10 text-indigo-300 border-indigo-400/20 dark:bg-indigo-500/15",
    zinc: "bg-white/6 text-zinc-300 border-white/10",
    amber:
      "bg-amber-500/10 text-amber-200 border-amber-400/20 dark:bg-amber-500/15",
    green:
      "bg-emerald-500/10 text-emerald-200 border-emerald-400/20 dark:bg-emerald-500/15",
    red: "bg-rose-500/10 text-rose-200 border-rose-400/20 dark:bg-rose-500/15",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tones[tone],
      )}
    >
      <span className="inline-block bg-current opacity-70 rounded-full w-1.5 h-1.5" />
      {children}
    </span>
  );
}

export default function DeckEditor({
  deckId,
  initialDeck,
  initialCards,
}: {
  deckId: string;
  initialDeck: Deck;
  initialCards: Card[];
}) {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:8000";

  const [deck] = useState(initialDeck);
  const [cards, setCards] = useState<EditableCard[]>(
    initialCards.map((c) => ({
      ...c,
      _dirty: false,
      _saving: false,
      _deleting: false,
      _error: null,
      _isTemp: false,
    })),
  );

  // UI filters (client-only)
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "oldest">("newest");

  const dirtyCount = useMemo(
    () => cards.filter((c) => c._dirty).length,
    [cards],
  );

  const visibleCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? cards
      : cards.filter((c) => {
          const hay = `${c.front}\n${c.back}`.toLowerCase();
          return hay.includes(q);
        });

    // We don't have created_at on cards here, so "newest" just means UI order
    // (we insert new ones at the top). "oldest" = reverse.
    return sortMode === "newest" ? filtered : [...filtered].reverse();
  }, [cards, query, sortMode]);

  function updateCard(cardId: string, patch: Partial<Card>) {
    setCards((prev) =>
      prev.map((c) =>
        c.card_id === cardId
          ? {
              ...c,
              ...patch,
              _dirty: true,
              _error: null,
            }
          : c,
      ),
    );
  }

  function revertCard(cardId: string) {
    const original = initialCards.find((c) => c.card_id === cardId);
    if (!original) {
      setCards((prev) =>
        prev.map((c) =>
          c.card_id === cardId
            ? { ...c, front: "", back: "", _dirty: false, _error: null }
            : c,
        ),
      );
      return;
    }

    setCards((prev) =>
      prev.map((c) =>
        c.card_id === cardId
          ? {
              ...original,
              _dirty: false,
              _saving: false,
              _error: null,
              _isTemp: false,
            }
          : c,
      ),
    );
  }

  async function saveCard(cardId: string) {
    const current = cards.find((c) => c.card_id === cardId);
    if (!current) return;

    if (current._isTemp) {
      return createCardFromTemp(cardId);
    }

    setCards((prev) =>
      prev.map((c) =>
        c.card_id === cardId ? { ...c, _saving: true, _error: null } : c,
      ),
    );

    try {
      const res = await fetch(`${API_URL}/decks/${deckId}/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ front: current.front, back: current.back }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Save failed (${res.status}) ${text}`);
      }

      setCards((prev) =>
        prev.map((c) =>
          c.card_id === cardId
            ? { ...c, _saving: false, _dirty: false, _error: null }
            : c,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setCards((prev) =>
        prev.map((c) =>
          c.card_id === cardId ? { ...c, _saving: false, _error: msg } : c,
        ),
      );
      console.error(e);
    }
  }

  async function createCardFromTemp(tempCardId: string) {
    const current = cards.find((c) => c.card_id === tempCardId);
    if (!current) return;

    setCards((prev) =>
      prev.map((c) =>
        c.card_id === tempCardId ? { ...c, _saving: true, _error: null } : c,
      ),
    );

    try {
      const res = await fetch(`${API_URL}/decks/${deckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify([
          { front: current.front || "", back: current.back || "" },
        ]),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Create failed (${res.status}) ${text}`);
      }

      const refetch = await fetch(`${API_URL}/decks/${deckId}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!refetch.ok) throw new Error(`Refetch failed (${refetch.status})`);
      const data = (await refetch.json()) as { deck: Deck; cards: Card[] };

      setCards(
        data.cards.map((c) => ({
          ...c,
          _dirty: false,
          _saving: false,
          _deleting: false,
          _error: null,
          _isTemp: false,
        })),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      setCards((prev) =>
        prev.map((c) =>
          c.card_id === tempCardId ? { ...c, _saving: false, _error: msg } : c,
        ),
      );
      console.error(e);
    }
  }

  async function saveAll() {
    const dirty = cards.filter((c) => c._dirty && !c._saving && !c._deleting);
    for (const c of dirty) {
      // eslint-disable-next-line no-await-in-loop
      await saveCard(c.card_id);
    }
  }

  async function addCard() {
    const id = tempId();
    const newCard: EditableCard = {
      card_id: id,
      deck_id: deckId,
      front: "",
      back: "",
      _dirty: true,
      _saving: false,
      _deleting: false,
      _error: null,
      _isTemp: true,
    };
    setCards((prev) => [newCard, ...prev]);
  }

  async function deleteCard(cardId: string) {
    const snapshot = cards;
    const target = cards.find((c) => c.card_id === cardId);
    if (!target) return;

    if (target._isTemp) {
      setCards((prev) => prev.filter((c) => c.card_id !== cardId));
      return;
    }

    setCards((prev) =>
      prev.map((c) => (c.card_id === cardId ? { ...c, _deleting: true } : c)),
    );

    try {
      const res = await fetch(`${API_URL}/decks/${deckId}/cards/${cardId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Delete failed (${res.status}) ${text}`);
      }

      setCards((prev) => prev.filter((c) => c.card_id !== cardId));
    } catch (e) {
      console.error(e);
      setCards(snapshot);
    }
  }

  return (
    <div className="relative bg-[#070A12] min-h-screen overflow-hidden text-white">
      {/* Indigo branded background */}
      <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_30%_-200px,rgba(99,102,241,0.30),transparent_60%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.22),transparent_55%),radial-gradient(700px_circle_at_15%_60%,rgba(56,189,248,0.10),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.10] pointer-events-none [background-image:radial-gradient(rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/80 pointer-events-none" />

      <div className="z-10 relative mx-auto px-6 py-10 max-w-6xl">
        {/* Top header */}
        <div className="flex justify-between items-start gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <span className="bg-white/5 px-2 py-1 border border-white/10 rounded-md">
                Deck
              </span>
              <span className="truncate">/{deck.deck_id}</span>
            </div>

            <h1 className="mt-3 font-semibold text-3xl truncate tracking-tight">
              {deck.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusPill tone="zinc">{cards.length} cards</StatusPill>
              {dirtyCount > 0 ? (
                <StatusPill tone="amber">{dirtyCount} unsaved</StatusPill>
              ) : (
                <StatusPill tone="green">All changes saved</StatusPill>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={addCard}
              className="bg-white/6 hover:bg-white/10 px-4 py-2 border border-white/12 rounded-xl font-medium text-white/90 text-sm active:scale-[0.98] transition"
            >
              + Add card
            </button>

            <button
              onClick={saveAll}
              disabled={dirtyCount === 0}
              className={cx(
                "rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98]",
                dirtyCount === 0
                  ? "cursor-not-allowed bg-white/10 text-white/40"
                  : "bg-indigo-500 text-white hover:bg-indigo-400",
              )}
            >
              Save all
            </button>
          </div>
        </div>

        {/* Sticky toolbar */}
        <div className="top-0 z-20 sticky bg-black/30 backdrop-blur-xl mt-8 p-3 border border-white/10 rounded-2xl">
          <div className="flex md:flex-row flex-col md:justify-between md:items-center gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative w-full md:max-w-md">
                <div className="top-2.5 left-3 absolute text-white/40 pointer-events-none">
                  ⌕
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cards…"
                  className="bg-white/5 py-2 pr-3 pl-9 border border-white/10 focus:border-indigo-400/30 rounded-xl outline-none ring-indigo-400/0 focus:ring-4 focus:ring-indigo-500/15 w-full text-white placeholder:text-white/35 text-sm transition"
                />
              </div>

              <div className="hidden md:block">
                <select
                  value={sortMode}
                  onChange={(e) =>
                    setSortMode(e.target.value as "newest" | "oldest")
                  }
                  className="bg-white/5 px-3 py-2 border border-white/10 focus:border-indigo-400/30 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/15 text-white/90 text-sm transition"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-white/50 text-xs">
                Showing{" "}
                <span className="font-medium text-white/80">
                  {visibleCards.length}
                </span>
              </div>
              <button
                onClick={() => setQuery("")}
                className="bg-white/5 hover:bg-white/10 px-3 py-2 border border-white/10 rounded-xl font-medium text-white/70 text-xs transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="gap-4 grid grid-cols-1 mt-5">
          {visibleCards.map((c, idx) => {
            const status = c._deleting
              ? { tone: "red" as const, label: "Deleting…" }
              : c._saving
                ? { tone: "indigo" as const, label: "Saving…" }
                : c._isTemp
                  ? { tone: "indigo" as const, label: "New" }
                  : c._dirty
                    ? { tone: "amber" as const, label: "Unsaved" }
                    : { tone: "green" as const, label: "Saved" };

            return (
              <div
                key={c.card_id}
                className={cx(
                  "group rounded-2xl border p-4 backdrop-blur-xl transition md:p-5",
                  "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]",
                  c._dirty && "border-indigo-400/25",
                  c._deleting && "opacity-60",
                )}
              >
                <div className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <span className="bg-white/5 px-2 py-1 border border-white/10 rounded-md">
                      Card {idx + 1}
                    </span>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteCard(c.card_id)}
                      disabled={c._saving || c._deleting}
                      className={cx(
                        "rounded-xl px-3 py-2 text-xs font-semibold transition",
                        c._saving || c._deleting
                          ? "cursor-not-allowed bg-white/10 text-white/35"
                          : "bg-rose-500/12 text-rose-200 hover:bg-rose-500/18",
                      )}
                    >
                      Delete
                    </button>

                    <button
                      onClick={() => revertCard(c.card_id)}
                      disabled={!c._dirty || c._saving || c._deleting}
                      className={cx(
                        "rounded-xl px-3 py-2 text-xs font-semibold transition",
                        !c._dirty || c._saving || c._deleting
                          ? "cursor-not-allowed bg-white/10 text-white/35"
                          : "bg-white/8 text-white/80 hover:bg-white/12",
                      )}
                    >
                      Cancel
                    </button>

                    <button
                      onClick={() => saveCard(c.card_id)}
                      disabled={!c._dirty || c._saving || c._deleting}
                      className={cx(
                        "rounded-xl px-3 py-2 text-xs font-semibold transition",
                        !c._dirty || c._saving || c._deleting
                          ? "cursor-not-allowed bg-white/10 text-white/35"
                          : "bg-indigo-500 text-white hover:bg-indigo-400",
                      )}
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 mt-4">
                  <div>
                    <label className="font-semibold text-[11px] text-white/60 tracking-wide">
                      FRONT
                    </label>
                    <textarea
                      value={c.front}
                      onChange={(e) =>
                        updateCard(c.card_id, { front: e.target.value })
                      }
                      placeholder="Type the question…"
                      className="bg-black/30 mt-2 px-3 py-3 border border-white/10 focus:border-indigo-400/30 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/15 w-full text-white text-sm transition resize-none"
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[11px] text-white/60 tracking-wide">
                      BACK
                    </label>
                    <textarea
                      value={c.back}
                      onChange={(e) =>
                        updateCard(c.card_id, { back: e.target.value })
                      }
                      placeholder="Type the answer…"
                      className="bg-black/30 mt-2 px-3 py-3 border border-white/10 focus:border-indigo-400/30 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/15 w-full text-white text-sm transition resize-none"
                      rows={4}
                    />
                  </div>
                </div>

                {c._error && (
                  <div className="bg-rose-500/10 mt-3 px-3 py-2 border border-rose-400/20 rounded-xl text-rose-200 text-xs">
                    {c._error}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-white/45 text-xs text-center">
          MemoAI · Indigo UI · Edits stay local until you press save.
        </div>
      </div>
    </div>
  );
}
