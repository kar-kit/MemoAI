import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import FlashcardsPage from "@/app/dashboard/decks/page";
// app/__tests__/decks-page.test.tsx
import React from "react";

// ---- mocks ----
vi.mock("next/headers", () => ({
  cookies: async () => ({
    toString: () => "session=abc",
  }),
}));

vi.mock("@/app/dashboard/_components/BackButton", () => ({
  default: (props: any) => <button aria-label={props.label ?? "Back"} />,
}));

vi.mock("@/app/dashboard/decks/_components/DeckGrid", () => ({
  default: ({ decks }: any) => (
    <div data-testid="deck-grid">count:{decks.length}</div>
  ),
}));

describe("FlashcardsPage (/dashboard/decks)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state when there are no decks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    render(await FlashcardsPage());

    expect(
      screen.getByRole("heading", { name: /your decks/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();

    expect(screen.getByText(/no decks yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create manually/i }),
    ).toHaveAttribute("href", "/dashboard/decks/new");

    // "Chat with MemoAI" is an <a>
    expect(
      screen.getByRole("link", { name: /chat with memoai/i }),
    ).toHaveAttribute("href", "/dashboard/chat");
  });

  it("renders deck count + DeckGrid when decks exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { deck_id: "d1", title: "A", card_count: 10 },
          { deck_id: "d2", title: "B", card_count: 5 },
        ],
      }),
    );

    render(await FlashcardsPage());

    expect(screen.getByText(/2 decks/i)).toBeInTheDocument();
    expect(screen.getByTestId("deck-grid")).toHaveTextContent("count:2");
  });

  it("throws if API returns non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "boom",
      }),
    );

    await expect(FlashcardsPage()).rejects.toThrow(/failed to load decks/i);
  });
});
