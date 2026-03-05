import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import DeckPage from "@/app/dashboard/decks/[deckId]/page";
// app/__tests__/deck-editor-page.test.tsx
import React from "react";

// ---- mocks ----
vi.mock("next/headers", () => ({
  cookies: async () => ({
    toString: () => "session=abc",
  }),
}));

vi.mock("@/app/dashboard/decks/[deckId]/deckEditor", () => ({
  default: ({ deckId, initialDeck, initialCards }: any) => (
    <div data-testid="deck-editor">
      {deckId}::{initialDeck.title}::cards:{initialCards.length}
    </div>
  ),
}));

describe("DeckPage (/dashboard/decks/[deckId])", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches deck+cards and renders DeckEditor with props", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          deck: { deck_id: "d1", title: "Deck Title" },
          cards: [{ card_id: "c1", deck_id: "d1", front: "f", back: "b" }],
        }),
      }),
    );

    render(await DeckPage({ params: Promise.resolve({ deckId: "d1" }) }));

    expect(screen.getByTestId("deck-editor")).toHaveTextContent(
      "d1::Deck Title::cards:1",
    );
  });

  it("throws if API returns non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(
      DeckPage({ params: Promise.resolve({ deckId: "d1" }) }),
    ).rejects.toThrow(/failed to load deck/i);
  });
});
