import { ApiError, apiFetch } from "@/lib/api/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

// app/__tests__/survey-questions.test.tsx
import React from "react";
import SurveyQuestionsPage from "@/app/dashboard/survey/questions/page";
import userEvent from "@testing-library/user-event";

// --- Router mock (shared push spy) ---
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

// --- IMPORTANT: remove BackButton mock (your page renders a real <button aria-label="Back">) ---
// If you *do* have a BackButton component, your mock path likely doesn't match the import,
// so it wasn't being used anyway.

// --- API client mock (ApiError must be same class used in page) ---
vi.mock("@/lib/api/client", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }
  return {
    ApiError,
    apiFetch: vi.fn(),
  };
});

// Copy of question texts from the component (NO trailing periods to avoid split-node/punctuation issues)
const QUESTION_TEXTS: string[] = [
  "Manually creating the flashcard deck required a high level of effort",
  "I found the process of manually creating flashcards time-consuming",
  "I felt that a significant amount of preparation was required before I could begin studying the manually created deck",
  "Using the AI feature to generate flashcards required less effort than creating them manually",
  "The AI-assisted process reduced the time needed to prepare before studying",
  "Reviewing and refining the AI-generated flashcards required less effort than creating flashcards from scratch",
  "I was able to begin studying more quickly when using the AI-generated deck compared to the manually created deck",
  "The process of studying flashcards using the spaced-repetition system was clear and easy to follow",
  "Rating my recall confidence during review felt intuitive and required little effort",
  "Overall, the AI-assisted process made using spaced repetition feel less effortful compared to manual creation",
  "I would be more likely to use a spaced-repetition system regularly if it included AI-assisted flashcard generation",
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function answerAllNeutral(user: ReturnType<typeof userEvent.setup>) {
  for (const text of QUESTION_TEXTS) {
    const qTextNode = screen.getByText(new RegExp(escapeRegExp(text), "i"));

    const card =
      qTextNode.closest('div[class*="rounded-xl"]') ??
      qTextNode.parentElement?.closest('div[class*="rounded-xl"]');

    if (!card) throw new Error(`Could not find question card for: ${text}`);

    await user.click(within(card).getByRole("button", { name: /neutral/i }));
  }
}

describe("Survey questions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockClear();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("renders survey heading and first section", () => {
    render(<SurveyQuestionsPage />);

    // Real DOM: <button aria-label="Back">Back</button>
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /^survey$/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/section a/i)).toBeInTheDocument();

    // Question text may be prefixed by "1 .", so match substring
    expect(
      screen.getByText(new RegExp(escapeRegExp(QUESTION_TEXTS[0]), "i")),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /submit survey/i }),
    ).toBeDisabled();
  });

  it("enables submit only when all questions are answered, then submits and shows success state", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValueOnce({ survey_response_id: "abc123" });

    render(<SurveyQuestionsPage />);

    await answerAllNeutral(user);

    const submitBtn = screen.getByRole("button", { name: /submit survey/i });

    // state updates can be async; wait for enable
    await waitFor(() => expect(submitBtn).toBeEnabled());

    await user.click(submitBtn);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    expect(await screen.findByText(/survey submitted/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to dashboard/i }),
    ).toBeInTheDocument();
  });

  it("routes back to dashboard after submit success screen", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValueOnce({ survey_response_id: "abc123" });

    render(<SurveyQuestionsPage />);

    await answerAllNeutral(user);

    const submitBtn = screen.getByRole("button", { name: /submit survey/i });
    await waitFor(() => expect(submitBtn).toBeEnabled());
    await user.click(submitBtn);

    await screen.findByText(/survey submitted/i);

    await user.click(
      screen.getByRole("button", { name: /back to dashboard/i }),
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("alerts ApiError message if submit fails with ApiError", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError("Nope", 400));

    render(<SurveyQuestionsPage />);

    await answerAllNeutral(user);

    const submitBtn = screen.getByRole("button", { name: /submit survey/i });
    await waitFor(() => expect(submitBtn).toBeEnabled());

    await user.click(submitBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Nope");
    });
  });
});
