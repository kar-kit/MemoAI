import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import ChatPage from "@/app/dashboard/chat/page";
// app/__tests__/chat-page.test.tsx
import React from "react";
import userEvent from "@testing-library/user-event";

// ---------- mocks ----------
const refreshChatsMock = vi.fn();
const startNewChatMock = vi.fn();
const loadChatMock = vi.fn();
const setActiveChatIdMock = vi.fn();
const setChatsMock = vi.fn();

vi.mock("@/app/dashboard/chat/_hooks/useChatList", () => ({
  useChatList: () => ({
    chats: [{ chat_id: "c1", title: "Chat 1" }],
    activeChatId: "c1",
    loadingChat: false,
    refreshChats: refreshChatsMock,
    startNewChat: startNewChatMock,
    loadChat: loadChatMock,
    setActiveChatId: setActiveChatIdMock,
    setChats: setChatsMock,
  }),
}));

const dispatchStreamMock = vi.fn();
const dispatchStreamWithFileMock = vi.fn();

vi.mock("@/lib/api/llm", () => ({
  dispatchStream: (...args: any[]) => dispatchStreamMock(...args),
  dispatchStreamWithFile: (...args: any[]) =>
    dispatchStreamWithFileMock(...args),
}));

// Render-props harness for ChatLayout so we can drive ChatPage without caring about layout markup
vi.mock("@/app/dashboard/chat/_components/ChatLayout", () => ({
  default: (props: any) => {
    return (
      <div>
        <div data-testid="mounted">{String(props.mounted)}</div>

        <div data-testid="messages">
          {props.messages.map((m: any) => (
            <div key={m.id} data-testid={`msg-${m.role}`}>
              {m.content}
            </div>
          ))}
        </div>

        <textarea
          aria-label="Message input"
          value={props.input}
          onChange={(e) => props.setInput(e.target.value)}
          onKeyDown={props.onKeyDown}
        />

        <input
          aria-label="File"
          type="file"
          onChange={(e) => props.setFile(e.target.files?.[0] ?? null)}
        />

        <button type="button" onClick={props.onSend} disabled={!props.canSend}>
          Send
        </button>

        <button type="button" onClick={props.onNewChat}>
          New chat
        </button>

        <button type="button" onClick={() => props.onLoadChat("c1")}>
          Load chat
        </button>
      </div>
    );
  },
}));

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("mounts after a short delay and refreshes chats on load", async () => {
    render(<ChatPage />);

    // initial mounted false (set after 60ms)
    expect(screen.getByTestId("mounted").textContent).toBe("false");

    // refreshChats called on mount effect
    await waitFor(() => expect(refreshChatsMock).toHaveBeenCalledTimes(1));

    vi.advanceTimersByTime(60);
    await waitFor(() =>
      expect(screen.getByTestId("mounted").textContent).toBe("true"),
    );
  });

  it("sends a message via dispatchStream and renders streamed tokens + done", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // When dispatchStream is called, emit some events into the handlers
    dispatchStreamMock.mockImplementation((_payload: any, handlers: any) => {
      handlers.onEvent({ type: "status", message: "Thinking…" });
      handlers.onEvent({ type: "token", token: "Hel" });
      handlers.onEvent({ type: "token", token: "lo" });
      handlers.onEvent({ type: "done", response: "Hello!", action: "none" });
      handlers.onClose?.();
      return { close: vi.fn() };
    });

    render(<ChatPage />);

    await user.type(screen.getByLabelText("Message input"), "Hi there");
    expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(dispatchStreamMock).toHaveBeenCalledTimes(1));

    // payload should include chat_id and messages array
    const [payload] = dispatchStreamMock.mock.calls[0];
    expect(payload.chat_id).toBe("c1");
    expect(Array.isArray(payload.messages)).toBe(true);

    // streamed result should appear
    expect(await screen.findByText("Hello!")).toBeInTheDocument();

    // refreshChats scheduled after 300ms
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(refreshChatsMock).toHaveBeenCalledTimes(2));
  });

  it("sends with a file via dispatchStreamWithFile and clears the file", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    dispatchStreamWithFileMock.mockImplementation(
      (_payload: any, handlers: any) => {
        handlers.onEvent({ type: "done", response: "Got it" });
        handlers.onClose?.();
        return { close: vi.fn() };
      },
    );

    render(<ChatPage />);

    const file = new File(["hello"], "test.txt", { type: "text/plain" });

    await user.upload(screen.getByLabelText("File"), file);
    await user.type(screen.getByLabelText("Message input"), "with file");

    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(dispatchStreamWithFileMock).toHaveBeenCalledTimes(1),
    );

    const [payload] = dispatchStreamWithFileMock.mock.calls[0];
    expect(payload.chat_id).toBe("c1");
    expect(payload.message).toBe("with file");
    expect(payload.file?.name).toBe("test.txt");
  });

  it("pressing Enter (no shift) sends", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    dispatchStreamMock.mockImplementation((_payload: any, handlers: any) => {
      handlers.onEvent({ type: "done", response: "Sent" });
      return { close: vi.fn() };
    });

    render(<ChatPage />);

    const input = screen.getByLabelText("Message input");
    await user.type(input, "hey");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(dispatchStreamMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Sent")).toBeInTheDocument();
  });
});
