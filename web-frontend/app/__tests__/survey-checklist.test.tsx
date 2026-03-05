import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// app/__tests__/survey-checklist.test.tsx
import React from "react";
import SurveyPage from "@/app/dashboard/survey/page";
import { pushMock } from "@/test/next-mocks";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/dashboard/_components/BackButton", () => ({
  default: () => <div data-testid="back-button" />,
}));

describe("Survey checklist page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders the survey checklist header and progress UI", () => {
    render(<SurveyPage />);

    expect(
      screen.getByRole("heading", { name: /user survey/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/study session checklist/i)).toBeInTheDocument();

    // ✅ be specific (avoid matching other sentences containing "progress")
    expect(screen.getByText(/^progress$/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();

    // Take survey exists but disabled initially
    expect(screen.getByRole("button", { name: /take survey/i })).toBeDisabled();
  });

  it("does not allow ticking checklist steps before selecting a group", async () => {
    const user = userEvent.setup();
    render(<SurveyPage />);

    const step1 = screen.getByRole("button", {
      name: /1\.\s*received the sample pdf\/ppt study material/i,
    });

    expect(step1).toBeDisabled();
    await user.click(step1);
    expect(step1).toBeDisabled();
  });

  it("allows ticking steps after selecting a group and updates progress", async () => {
    const user = userEvent.setup();
    render(<SurveyPage />);

    await user.click(screen.getByRole("button", { name: /group a/i }));

    const step1 = screen.getByRole("button", {
      name: /1\.\s*received the sample pdf\/ppt study material/i,
    });

    expect(step1).toBeEnabled();
    expect(screen.getByText(/0\s*\/\s*8 steps completed/i)).toBeInTheDocument();

    await user.click(step1);
    expect(screen.getByText(/1\s*\/\s*8 steps completed/i)).toBeInTheDocument();
  });

  it("enables Take survey only when step 8 is checked, then routes to questions page", async () => {
    const user = userEvent.setup();
    render(<SurveyPage />);

    await user.click(screen.getByRole("button", { name: /group a/i }));

    const takeSurveyBtn = screen.getByRole("button", { name: /take survey/i });
    expect(takeSurveyBtn).toBeDisabled();

    const step8 = screen.getByRole("button", {
      name: /8\.\s*finished both workflows/i,
    });

    await user.click(step8);
    expect(takeSurveyBtn).toBeEnabled();

    await user.click(takeSurveyBtn);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/survey/questions");
  });

  it("reset clears group + progress and disables interaction again", async () => {
    const user = userEvent.setup();
    render(<SurveyPage />);

    await user.click(screen.getByRole("button", { name: /group b/i }));

    const step1 = screen.getByRole("button", {
      name: /1\.\s*received the sample pdf\/ppt study material/i,
    });
    await user.click(step1);

    expect(screen.getByText(/1\s*\/\s*8 steps completed/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reset/i }));

    expect(screen.getByText(/0\s*\/\s*8 steps completed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take survey/i })).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /1\.\s*received the sample pdf\/ppt study material/i,
      }),
    ).toBeDisabled();
  });

  it("hydrates from localStorage (group + checked) on load", () => {
    window.localStorage.setItem(
      "memoai_survey_checklist_v1",
      JSON.stringify({
        group: "A",
        checked: { "ready-for-survey": true },
      }),
    );

    render(<SurveyPage />);
    expect(screen.getByRole("button", { name: /take survey/i })).toBeEnabled();
  });
});
