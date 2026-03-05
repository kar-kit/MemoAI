import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import Dashboard from "@/app/dashboard/page";
// app/__tests__/dashboard.test.tsx
import React from "react";

describe("Dashboard page", () => {
  it("renders main heading + description", () => {
    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: /everything you need/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/create and edit decks/i)).toBeInTheDocument();
  });

  it("renders cards with correct links", () => {
    render(<Dashboard />);

    expect(screen.getByRole("link", { name: /open survey/i })).toHaveAttribute(
      "href",
      "/dashboard/survey",
    );

    expect(screen.getByRole("link", { name: /open library/i })).toHaveAttribute(
      "href",
      "/dashboard/decks",
    );

    expect(screen.getByRole("link", { name: /open chat/i })).toHaveAttribute(
      "href",
      "/dashboard/chat",
    );
  });

  it("shows the tip footer", () => {
    render(<Dashboard />);
    expect(
      screen.getByText(/10 minutes daily beats cramming/i),
    ).toBeInTheDocument();
  });
});
