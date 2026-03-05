// app/__tests__/login.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Login from "@/app/logsys/login/page";
import { ApiError } from "@/lib/api/client";
import { login, type LoginResponse } from "@/lib/api/auth";
import { toast } from "sonner";
import { pushMock } from "@/test/next-mocks";

vi.mock("@/lib/api/auth", () => ({
  login: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login UI", () => {
    render(<Login />);

    expect(
      screen.getByRole("heading", { name: /welcome back/i }),
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute(
      "href",
      "/logsys/register",
    );
  });

  it("submits credentials, shows success toast, and routes to /dashboard", async () => {
    const user = userEvent.setup();

    vi.mocked(login).mockResolvedValueOnce({
      id: "1",
      uid: "u1",
      name: "Joey",
      email: "joey@example.com",
    });

    render(<Login />);

    await user.type(screen.getByPlaceholderText(/email/i), "joey@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "joey@example.com",
        password: "password123",
      });
    });

    expect(toast.success).toHaveBeenCalledWith("Welcome back, Joey.");
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows specific error toast for 401 ApiError", async () => {
    const user = userEvent.setup();

    vi.mocked(login).mockRejectedValueOnce(
      new ApiError("Invalid email or password", 401),
    );

    render(<Login />);

    await user.type(screen.getByPlaceholderText(/email/i), "bad@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid email or password.");
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows generic error toast for non-401 errors", async () => {
    const user = userEvent.setup();

    vi.mocked(login).mockRejectedValueOnce(new ApiError("Server blew up", 500));

    render(<Login />);

    await user.type(screen.getByPlaceholderText(/email/i), "x@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "y");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Login failed.");
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables button and shows 'Signing in...' while submitting", async () => {
    const user = userEvent.setup();

    let resolve!: (v: LoginResponse) => void;

    vi.mocked(login).mockImplementationOnce(
      () =>
        new Promise<LoginResponse>((res) => {
          resolve = res;
        }),
    );

    render(<Login />);

    await user.type(screen.getByPlaceholderText(/email/i), "joey@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "password123");

    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    // pending state
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();

    resolve({
      id: "1",
      uid: "u1",
      name: "Joey",
      email: "joey@example.com",
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
