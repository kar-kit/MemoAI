import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import DeckEditor from "@/app/dashboard/decks/[deckId]/deckEditor";
import React from "react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/dashboard/_components/BackButton", () => ({
  default: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
}));

describe("DeckPage server page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
  });

  it("fetches the deck with cookies and renders DeckEditor", async () => {
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => ({
        toString: () => "session=abc123",
      })),
    }));

    vi.doMock("@/app/dashboard/decks/[deckId]/deckEditor", () => ({
      default: ({
        deckId,
        initialDeck,
        initialCards,
      }: {
        deckId: string;
        initialDeck: { title: string };
        initialCards: Array<{ card_id: string }>;
      }) => (
        <div data-testid="deck-editor">
          {deckId} | {initialDeck.title} | {initialCards.length}
        </div>
      ),
    }));

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        json: async () => ({
          deck: {
            deck_id: "d1",
            title: "Networks",
            description: null,
          },
          cards: [
            {
              card_id: "c1",
              deck_id: "d1",
              front: "Q1",
              back: "A1",
            },
          ],
        }),
      },
    );

    const { default: DeckPage } =
      await import("@/app/dashboard/decks/[deckId]/page");

    const element = await DeckPage({
      params: Promise.resolve({ deckId: "d1" }),
    });

    render(element);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/decks/d1",
      {
        method: "GET",
        headers: { cookie: "session=abc123" },
        cache: "no-store",
      },
    );

    expect(screen.getByTestId("deck-editor")).toHaveTextContent(
      "d1 | Networks | 1",
    );
  });

  it("throws when deck load fails", async () => {
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => ({
        toString: () => "session=abc123",
      })),
    }));

    vi.doMock("@/app/dashboard/decks/[deckId]/deckEditor", () => ({
      default: () => <div>editor</div>,
    }));

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: false,
        status: 404,
      },
    );

    const { default: DeckPage } =
      await import("@/app/dashboard/decks/[deckId]/page");

    await expect(
      DeckPage({ params: Promise.resolve({ deckId: "missing" }) }),
    ).rejects.toThrow("Failed to load deck (404)");
  });
});

describe("DeckEditor", () => {
  const initialDeck = {
    deck_id: "deck-1",
    title: "Algorithms",
    description: null,
  };

  const initialCards = [
    {
      card_id: "c1",
      deck_id: "deck-1",
      front: "What is BFS?",
      back: "Breadth-first search",
    },
    {
      card_id: "c2",
      deck_id: "deck-1",
      front: "What is DFS?",
      back: "Depth-first search",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
  });

  it("renders deck info and initial cards", () => {
    render(
      <DeckEditor
        deckId="deck-1"
        initialDeck={initialDeck}
        initialCards={initialCards}
      />,
    );

    expect(screen.getByText("Algorithms")).toBeInTheDocument();
    expect(screen.getByText("2 cards")).toBeInTheDocument();
    expect(screen.getByText(/all changes saved/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("What is BFS?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("What is DFS?")).toBeInTheDocument();
  });

  it("filters visible cards using the search input", async () => {
    const user = userEvent.setup();

    render(
      <DeckEditor
        deckId="deck-1"
        initialDeck={initialDeck}
        initialCards={initialCards}
      />,
    );

    const search = screen.getByPlaceholderText(/search cards/i);

    await user.type(search, "bfs");

    expect(screen.getByDisplayValue("What is BFS?")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("What is DFS?")).not.toBeInTheDocument();
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
  });

  it("marks a card unsaved after editing and saves it with PATCH", async () => {
    const user = userEvent.setup();

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        text: async () => "",
      },
    );

    render(
      <DeckEditor
        deckId="deck-1"
        initialDeck={initialDeck}
        initialCards={initialCards}
      />,
    );

    const frontAreas = screen.getAllByPlaceholderText(/type the question/i);

    await user.clear(frontAreas[0]);
    await user.type(frontAreas[0], "What is BFS updated?");

    expect(screen.getByText(/1 unsaved/i)).toBeInTheDocument();

    const saveButtons = screen.getAllByRole("button", { name: /^save$/i });
    await user.click(saveButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/decks/deck-1/cards/c1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            front: "What is BFS updated?",
            back: "Breadth-first search",
          }),
        },
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/all changes saved/i)).toBeInTheDocument();
    });
  });

  it("adds a temp card and creates it on save, then refetches cards", async () => {
    const user = userEvent.setup();

    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deck: initialDeck,
          cards: [
            {
              card_id: "c1",
              deck_id: "deck-1",
              front: "What is BFS?",
              back: "Breadth-first search",
            },
            {
              card_id: "c2",
              deck_id: "deck-1",
              front: "What is DFS?",
              back: "Depth-first search",
            },
            {
              card_id: "c3",
              deck_id: "deck-1",
              front: "New question",
              back: "New answer",
            },
          ],
        }),
      });

    render(
      <DeckEditor
        deckId="deck-1"
        initialDeck={initialDeck}
        initialCards={initialCards}
      />,
    );

    await user.click(screen.getByRole("button", { name: /\+ add card/i }));

    const frontAreas = screen.getAllByPlaceholderText(/type the question/i);
    const backAreas = screen.getAllByPlaceholderText(/type the answer/i);

    await user.type(frontAreas[0], "New question");
    await user.type(backAreas[0], "New answer");

    const saveButtons = screen.getAllByRole("button", { name: /^save$/i });
    await user.click(saveButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        "http://localhost:8000/decks/deck-1/cards",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify([{ front: "New question", back: "New answer" }]),
        },
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "http://localhost:8000/decks/deck-1",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );
    });

    expect(await screen.findByDisplayValue("New question")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("New answer")).toBeInTheDocument();
  });

  it("deletes an existing card", async () => {
    const user = userEvent.setup();

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        text: async () => "",
      },
    );

    render(
      <DeckEditor
        deckId="deck-1"
        initialDeck={initialDeck}
        initialCards={initialCards}
      />,
    );

    expect(screen.getByDisplayValue("What is DFS?")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[1]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/decks/deck-1/cards/c2",
        {
          method: "DELETE",
          credentials: "include",
        },
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByDisplayValue("What is DFS?"),
      ).not.toBeInTheDocument();
    });
  });

  it("reverts a dirty card back to its original values", async () => {
    const user = userEvent.setup();

    render(
      <DeckEditor
        deckId="deck-1"
        initialDeck={initialDeck}
        initialCards={initialCards}
      />,
    );

    const frontAreas = screen.getAllByPlaceholderText(/type the question/i);

    await user.clear(frontAreas[0]);
    await user.type(frontAreas[0], "Temporary change");

    expect(screen.getByText(/1 unsaved/i)).toBeInTheDocument();

    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
    await user.click(cancelButtons[0]);

    expect(screen.getByDisplayValue("What is BFS?")).toBeInTheDocument();
    expect(screen.getByText(/all changes saved/i)).toBeInTheDocument();
  });

  it("clears the search query when clear is clicked", async () => {
    const user = userEvent.setup();

    render(
      <DeckEditor
        deckId="deck-1"
        initialDeck={initialDeck}
        initialCards={initialCards}
      />,
    );

    const search = screen.getByPlaceholderText(/search cards/i);

    await user.type(search, "dfs");
    expect(screen.queryByDisplayValue("What is BFS?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear/i }));

    expect(screen.getByDisplayValue("What is BFS?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("What is DFS?")).toBeInTheDocument();
  });
});
