// /app/__tests__/new-page.test.tsx

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import NewDeckPage from "../dashboard/decks/new/page";
import React from "react";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("../dashboard/_components/BackButton", () => ({
  default: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
}));

describe("NewDeckPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders heading, back button, title input, and 3 default cards", () => {
    render(<NewDeckPage />);

    expect(
      screen.getByRole("heading", { name: /create a new deck/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/operating systems week 4/i),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/card \d+/i)).toHaveLength(3);
    expect(
      screen.getByText(/0 complete cards ready to save/i),
    ).toBeInTheDocument();
  });

  it("adds a new card when clicking add card", () => {
    render(<NewDeckPage />);

    fireEvent.click(screen.getByRole("button", { name: /\+ add card/i }));

    expect(screen.getAllByText(/card \d+/i)).toHaveLength(4);
  });

  it("removes a card when more than one exists", () => {
    render(<NewDeckPage />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[1]);

    expect(screen.getAllByText(/card \d+/i)).toHaveLength(2);
  });

  it("does not allow removing the final remaining card", () => {
    render(<NewDeckPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });

    expect(removeButtons).toHaveLength(1);
    expect(removeButtons[0]).toBeDisabled();
  });

  it("updates the complete card count only when both front and back are filled", () => {
    render(<NewDeckPage />);

    const frontTextareas = screen.getAllByPlaceholderText(/type the question/i);
    const backTextareas = screen.getAllByPlaceholderText(/type the answer/i);

    fireEvent.change(frontTextareas[0], {
      target: { value: "What is an OS?" },
    });

    expect(
      screen.getByText(/0 complete cards ready to save/i),
    ).toBeInTheDocument();

    fireEvent.change(backTextareas[0], {
      target: {
        value: "Software that manages hardware and software resources.",
      },
    });

    expect(
      screen.getByText(/1 complete card ready to save/i),
    ).toBeInTheDocument();

    fireEvent.change(frontTextareas[1], {
      target: { value: "   " },
    });
    fireEvent.change(backTextareas[1], {
      target: { value: "Something" },
    });

    expect(
      screen.getByText(/1 complete card ready to save/i),
    ).toBeInTheDocument();
  });

  it("shows validation error when submitting with no complete cards", async () => {
    render(<NewDeckPage />);

    fireEvent.click(screen.getByRole("button", { name: /create deck/i }));

    expect(
      await screen.findByText(/add at least one complete card before saving/i),
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("submits deck and cards successfully, then redirects", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deck_id: "deck-123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<NewDeckPage />);

    fireEvent.change(screen.getByPlaceholderText(/operating systems week 4/i), {
      target: { value: "Operating Systems Week 4" },
    });

    fireEvent.change(screen.getAllByPlaceholderText(/type the question/i)[0], {
      target: { value: "What is paging?" },
    });

    fireEvent.change(screen.getAllByPlaceholderText(/type the answer/i)[0], {
      target: { value: "A memory management scheme." },
    });

    fireEvent.click(screen.getByRole("button", { name: /create deck/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/decks",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Operating Systems Week 4",
          source_type: "text",
          source_ref: null,
          tags: [],
        }),
      },
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8000/decks/deck-123/cards",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            front: "What is paging?",
            back: "A memory management scheme.",
          },
        ]),
      },
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard/decks/");
    });
  });

  it("uses Untitled deck when title is blank", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deck_id: "deck-456" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<NewDeckPage />);

    fireEvent.change(screen.getAllByPlaceholderText(/type the question/i)[0], {
      target: { value: "Q1" },
    });

    fireEvent.change(screen.getAllByPlaceholderText(/type the answer/i)[0], {
      target: { value: "A1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create deck/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/decks",
      expect.objectContaining({
        body: JSON.stringify({
          title: "Untitled deck",
          source_type: "text",
          source_ref: null,
          tags: [],
        }),
      }),
    );
  });

  it("only submits complete cards", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deck_id: "deck-789" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<NewDeckPage />);

    const fronts = screen.getAllByPlaceholderText(/type the question/i);
    const backs = screen.getAllByPlaceholderText(/type the answer/i);

    fireEvent.change(fronts[0], { target: { value: "Q1" } });
    fireEvent.change(backs[0], { target: { value: "A1" } });

    fireEvent.change(fronts[1], { target: { value: "Q2 only" } });
    fireEvent.change(backs[2], { target: { value: "A3 only" } });

    fireEvent.click(screen.getByRole("button", { name: /create deck/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8000/decks/deck-789/cards",
      expect.objectContaining({
        body: JSON.stringify([{ front: "Q1", back: "A1" }]),
      }),
    );
  });

  it("shows an error if deck creation fails", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: false,
        status: 500,
        text: async () => "Server exploded",
      },
    );

    render(<NewDeckPage />);

    fireEvent.change(screen.getAllByPlaceholderText(/type the question/i)[0], {
      target: { value: "Q1" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/type the answer/i)[0], {
      target: { value: "A1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create deck/i }));

    expect(
      await screen.findByText(/failed to create deck \(500\) server exploded/i),
    ).toBeInTheDocument();

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows an error if card creation fails", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deck_id: "deck-101" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad cards payload",
      });

    render(<NewDeckPage />);

    fireEvent.change(screen.getAllByPlaceholderText(/type the question/i)[0], {
      target: { value: "Q1" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/type the answer/i)[0], {
      target: { value: "A1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create deck/i }));

    expect(
      await screen.findByText(/failed to add cards \(400\) bad cards payload/i),
    ).toBeInTheDocument();

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables submit button and shows loading text while submitting", async () => {
    let resolveDeck!: (value: unknown) => void;

    const deckPromise = new Promise((resolve) => {
      resolveDeck = resolve;
    });

    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(deckPromise)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<NewDeckPage />);

    fireEvent.change(screen.getAllByPlaceholderText(/type the question/i)[0], {
      target: { value: "Q1" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/type the answer/i)[0], {
      target: { value: "A1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create deck/i }));

    expect(
      screen.getByRole("button", { name: /creating deck/i }),
    ).toBeDisabled();

    resolveDeck({
      ok: true,
      json: async () => ({ deck_id: "deck-loading" }),
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard/decks/");
    });
  });
});
