import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// app/__tests__/register.test.tsx
import React from "react";
import Register from "@/app/logsys/register/page";
import { pushMock } from "@/test/next-mocks";
import { register } from "@/lib/api/auth";
import { toast } from "sonner";
import userEvent from "@testing-library/user-event";

// mock register API
vi.mock("@/lib/api/auth", () => ({
  register: vi.fn(),
}));

// mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Register page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the register UI", () => {
    render(<Register />);

    expect(
      screen.getByRole("heading", { name: /create account/i }),
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/access code/i)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/logsys/login",
    );
  });

  it("blocks registration when access code is wrong", async () => {
    const user = userEvent.setup();

    render(<Register />);

    await user.type(screen.getByPlaceholderText(/name/i), "Joey");
    await user.type(screen.getByPlaceholderText(/email/i), "joey@example.com");
    await user.type(screen.getByPlaceholderText(/^password$/i), "password123");
    await user.type(screen.getByPlaceholderText(/access code/i), "WrongCode");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(toast.error).toHaveBeenCalledWith("Invalid access code.");
    expect(register).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("submits registration when access code is correct", async () => {
    const user = userEvent.setup();

    vi.mocked(register).mockResolvedValueOnce({
      id: "1",
      uid: "u1",
      name: "Joey",
      email: "joey@example.com",
    });

    render(<Register />);

    await user.type(screen.getByPlaceholderText(/name/i), "Joey");
    await user.type(screen.getByPlaceholderText(/email/i), "joey@example.com");
    await user.type(screen.getByPlaceholderText(/^password$/i), "password123");
    await user.type(
      screen.getByPlaceholderText(/access code/i),
      "HongKong2005",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        name: "Joey",
        email: "joey@example.com",
        password: "password123",
      });
    });

    expect(toast.success).toHaveBeenCalledWith("Account created.");
    expect(pushMock).toHaveBeenCalledWith("/logsys/login");
  });

  it("shows error toast if backend registration fails", async () => {
    const user = userEvent.setup();

    vi.mocked(register).mockRejectedValueOnce(new Error("boom"));

    render(<Register />);

    await user.type(screen.getByPlaceholderText(/name/i), "Joey");
    await user.type(screen.getByPlaceholderText(/email/i), "joey@example.com");
    await user.type(screen.getByPlaceholderText(/^password$/i), "password123");
    await user.type(
      screen.getByPlaceholderText(/access code/i),
      "HongKong2005",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Registration failed.");
    });

    expect(pushMock).not.toHaveBeenCalled();
  });
});
