import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import React from "react";
import StudyClient from "@/app/dashboard/decks/study/[deckId]/studyClient";
import userEvent from "@testing-library/user-event";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("StudyPage server page", () => {
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

  it("fetches the deck with cookies and renders StudyClient", async () => {
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => ({
        toString: () => "session=abc123",
      })),
    }));

    vi.doMock("@/app/dashboard/decks/study/[deckId]/studyClient", () => ({
      default: ({ deck }: { deck: { title: string } }) => (
        <div data-testid="study-client">{deck.title}</div>
      ),
    }));

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        json: async () => ({
          deck: {
            deck_id: "d1",
            title: "OS Deck",
            description: null,
          },
          cards: [],
        }),
      },
    );

    const { default: StudyPage } =
      await import("@/app/dashboard/decks/study/[deckId]/page");

    const element = await StudyPage({
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

    expect(screen.getByTestId("study-client")).toHaveTextContent("OS Deck");
  });

  it("throws when deck loading fails", async () => {
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => ({
        toString: () => "session=abc123",
      })),
    }));

    vi.doMock("@/app/dashboard/decks/study/[deckId]/studyClient", () => ({
      default: ({ deck }: { deck: { title: string } }) => (
        <div>{deck.title}</div>
      ),
    }));

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: false,
        status: 500,
        text: async () => "boom",
      },
    );

    const { default: StudyPage } =
      await import("@/app/dashboard/decks/study/[deckId]/page");

    await expect(
      StudyPage({ params: Promise.resolve({ deckId: "d1" }) }),
    ).rejects.toThrow("Failed to load deck (500) boom");
  });
});

describe("StudyClient", () => {
  const deck = { deck_id: "deck-1", title: "Biology Deck" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
  });

  it("loads and displays the next card", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        json: async () => ({
          card: {
            card_id: "c1",
            deck_id: "deck-1",
            front: "What is photosynthesis?",
            back: "It is how plants convert light into energy.",
            last_rating: 4,
          },
          remaining: 2,
        }),
      },
    );

    render(<StudyClient deck={deck} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    expect(
      await screen.findByText("What is photosynthesis?"),
    ).toBeInTheDocument();

    expect(screen.getByText("3 remaining")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show answer/i }),
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/decks/deck-1/study/next",
      { credentials: "include" },
    );
  });

  it("shows the answer after clicking show answer", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        json: async () => ({
          card: {
            card_id: "c1",
            deck_id: "deck-1",
            front: "Front of card",
            back: "Back of card",
            last_rating: 2,
          },
          remaining: 0,
        }),
      },
    );

    render(<StudyClient deck={deck} />);

    expect(await screen.findByText("Front of card")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));

    expect(await screen.findByText("Back of card")).toBeInTheDocument();
    expect(screen.getByText(/rate how well you knew it/i)).toBeInTheDocument();
  });

  it("rates a card and then fetches the next one", async () => {
    const user = userEvent.setup();

    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          card: {
            card_id: "c1",
            deck_id: "deck-1",
            front: "Question 1",
            back: "Answer 1",
            last_rating: 3,
          },
          remaining: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          card: {
            card_id: "c2",
            deck_id: "deck-1",
            front: "Question 2",
            back: "Answer 2",
            last_rating: null,
          },
          remaining: 0,
        }),
      });

    render(<StudyClient deck={deck} />);

    expect(await screen.findByText("Question 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show answer/i }));
    expect(await screen.findByText("Answer 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "4" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "http://localhost:8000/decks/deck-1/study/c1/rate",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: 4 }),
        },
      );
    });

    expect(await screen.findByText("Question 2")).toBeInTheDocument();
  });

  it("shows session complete when no more cards exist", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        json: async () => ({
          card: null,
          remaining: 0,
        }),
      },
    );

    render(<StudyClient deck={deck} />);

    expect(await screen.findByText(/session complete/i)).toBeInTheDocument();
    expect(screen.getByText(/no more cards to review/i)).toBeInTheDocument();
  });

  it("prevents duplicate rating requests while already rating", async () => {
    const user = userEvent.setup();

    let resolveRate!: () => void;
    const slowRate = new Promise((resolve) => {
      resolveRate = () => resolve(undefined);
    });

    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          card: {
            card_id: "c1",
            deck_id: "deck-1",
            front: "Question",
            back: "Answer",
            last_rating: null,
          },
          remaining: 0,
        }),
      })
      .mockReturnValueOnce(slowRate)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          card: null,
          remaining: 0,
        }),
      });

    render(<StudyClient deck={deck} />);

    expect(await screen.findByText("Question")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show answer/i }));
    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "5" }));

    expect(global.fetch).toHaveBeenCalledTimes(2);

    resolveRate();

    await waitFor(() => {
      expect(screen.getByText(/session complete/i)).toBeInTheDocument();
    });
  });
});
