import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// app/__tests__/study-page.test.tsx
import React from "react";
import StudyPage from "@/app/dashboard/decks/study/[deckId]/page";

// ---- mocks ----
vi.mock("next/headers", () => ({
  cookies: async () => ({
    toString: () => "session=abc",
  }),
}));

vi.mock("@/app/dashboard/decks/study/[deckId]/studyClient", () => ({
  default: ({ deck }: any) => (
    <div data-testid="study-client">{deck.title}</div>
  ),
}));

describe("StudyPage (/dashboard/decks/study/[deckId])", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches deck and renders StudyClient with deck", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          deck: { deck_id: "d1", title: "My Deck" },
          cards: [],
        }),
      }),
    );

    render(await StudyPage({ params: Promise.resolve({ deckId: "d1" }) }));

    expect(screen.getByTestId("study-client")).toHaveTextContent("My Deck");
  });

  it("throws if deck fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "nope",
      }),
    );

    await expect(
      StudyPage({ params: Promise.resolve({ deckId: "missing" }) }),
    ).rejects.toThrow(/failed to load deck/i);
  });
});
