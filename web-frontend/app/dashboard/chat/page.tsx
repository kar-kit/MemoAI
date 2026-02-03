// app/dashboard/chat/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

// Backend response shapes (match your FastAPI)
type ChatsListItem = {
  chat_id: string;
  title: string;
  updated_at: string;
};

type ChatDetailMessage = {
  role: Role;
  content: string;
};

type ChatDetailResponse = {
  chat_id: string;
  title: string;
  messages: ChatDetailMessage[];
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const DEFAULT_ASSISTANT: ChatMessage = {
  id: uid(),
  role: "assistant",
  content: "Hey — send me a message and I’ll reply.",
};

export default function ChatPage() {
  const [mounted, setMounted] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_ASSISTANT]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [file, setFile] = useState<File | null>(null);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);

  // ✅ Memoize so it can be used safely in deps
  const API_URL = useMemo(() => {
    return (
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
      "http://localhost:8000"
    );
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, loadingChat]);

  const refreshChats = useCallback(async () => {
    const res = await fetch(`${API_URL}/llm/chats`, {
      credentials: "include",
    });
    if (!res.ok) return;

    const data = (await res.json()) as ChatsListItem[];
    const mapped: ChatSummary[] = data.map((c) => ({
      id: c.chat_id,
      title: c.title,
      updatedAt: c.updated_at,
    }));
    setChats(mapped);

    // Optional: auto-set active chat if none selected
    if (!activeChatId && mapped.length > 0) {
      setActiveChatId(mapped[0].id);
    }
  }, [API_URL, activeChatId]);

  useEffect(() => {
    void refreshChats();
  }, [refreshChats]);

  const startNewChat = useCallback(async () => {
    // NOTE: you must have POST /llm/chats implemented on backend.
    const res = await fetch(`${API_URL}/llm/chats`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      // If route doesn't exist yet, fail gracefully
      console.error("POST /llm/chats failed:", res.status);
      return null;
    }

    const created = (await res.json()) as {
      chat_id: string;
      title: string;
      updated_at: string;
    };

    const newChat: ChatSummary = {
      id: created.chat_id,
      title: created.title ?? "New chat",
      updatedAt: created.updated_at,
    };

    setActiveChatId(newChat.id);
    setMessages([
      {
        id: uid(),
        role: "assistant",
        content: "Hey — send me a message and I’ll reply.",
      },
    ]);

    setChats((prev) => [newChat, ...prev.filter((c) => c.id !== newChat.id)]);
    return newChat.id;
  }, [API_URL]);

  const loadChat = useCallback(
    async (chatId: string) => {
      setLoadingChat(true);
      try {
        const res = await fetch(`${API_URL}/llm/chats/${chatId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load chat (${res.status})`);

        const data = (await res.json()) as ChatDetailResponse;

        setActiveChatId(chatId);
        setMessages(
          data.messages.map((m) => ({
            id: uid(),
            role: m.role,
            content: m.content,
          })),
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingChat(false);
      }
    },
    [API_URL],
  );

  const canSend = useMemo(() => {
    return !isSending && Boolean(input.trim()) && !loadingChat;
  }, [isSending, input, loadingChat]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending || loadingChat) return;

    // ✅ ensure we have a chat id before sending
    let chatId = activeChatId;
    if (!chatId) {
      chatId = await startNewChat();
      if (!chatId) return; // backend route missing or failed
    }

    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      // File route (your backend currently does NOT save file chats to DB)
      if (file) {
        const assistantId = uid();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        const form = new FormData();
        form.append("message", trimmed);
        form.append("file", file);

        const res = await fetch(`${API_URL}/llm/chat/with-file`, {
          method: "POST",
          credentials: "include",
          body: form,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed (${res.status})`);
        }

        const data = (await res.json()) as { response?: string };
        const assistantText = data.response?.trim() || "…";

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantText } : m,
          ),
        );

        setFile(null);
        return;
      }

      // SSE stream
      const payload = {
        chat_id: chatId,
        messages: [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const res = await fetch(`${API_URL}/llm/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;

          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr) continue;

          const evt = JSON.parse(jsonStr) as
            | { type: "token"; token: string }
            | { type: "done" }
            | { type: "error"; message: string };

          if (evt.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + evt.token }
                  : m,
              ),
            );
          }

          if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }

      // refresh sidebar timestamps after message
      await refreshChats();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Sorry — I couldn’t reach the server. Check the API URL / CORS and try again.";

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: msg },
      ]);
      console.error("Chat error:", err);
    } finally {
      setIsSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="relative flex bg-zinc-50 dark:bg-black h-screen overflow-hidden">
      {/* iOS-like backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(59,130,246,0.10),transparent_60%),radial-gradient(900px_circle_at_20%_20%,rgba(14,165,233,0.10),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(168,85,247,0.10),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.10] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 dark:from-black/40 via-transparent to-zinc-50/60 dark:to-black/60 pointer-events-none" />

      {/* Sidebar */}
      <aside className="z-10 relative flex flex-col bg-white/70 dark:bg-zinc-950/60 backdrop-blur-xl border-zinc-200/70 dark:border-zinc-800/80 border-r w-64 shrink-0">
        <div className="p-4">
          <button
            onClick={() => void startNewChat()}
            className="bg-zinc-900 dark:bg-zinc-50 py-2 rounded-xl w-full font-medium text-white dark:text-zinc-900 text-sm active:scale-[0.98] transition"
          >
            + New chat
          </button>
        </div>

        <div className="flex-1 space-y-1 px-2 overflow-y-auto">
          {chats.length === 0 && (
            <p className="px-3 py-2 text-zinc-500 dark:text-zinc-400 text-xs">
              No chats yet
            </p>
          )}

          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => void loadChat(chat.id)} // ✅ ACTUALLY LOADS CHAT
              className={[
                "w-full text-left px-3 py-2 rounded-lg text-sm transition",
                activeChatId === chat.id
                  ? "bg-zinc-200 dark:bg-zinc-800"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
              ].join(" ")}
            >
              <div className="font-medium truncate">
                {chat.title || "New chat"}
              </div>
              <div className="text-zinc-500 text-xs">
                {new Date(chat.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat */}
      <main
        className={[
          "relative z-10 flex flex-col flex-1 px-6",
          "transition-all duration-700 ease-out transform-gpu",
          mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        ].join(" ")}
      >
        <div className="pt-10 pb-6 text-center">
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-5xl tracking-tight">
            Chat
          </h1>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400 text-sm">
            Tip: Keep sessions short — consistency beats cramming.
          </p>
        </div>

        <div className="relative flex-1 bg-white/60 dark:bg-zinc-950/50 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl p-4 md:p-6 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl">
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/50 dark:ring-white/10 pointer-events-none" />

          {/* ✅ uses loadingChat so ESLint stops complaining */}
          {loadingChat && (
            <div className="z-10 absolute inset-0 place-items-center grid bg-white/40 dark:bg-black/40 backdrop-blur-sm rounded-2xl">
              <div className="bg-white/80 dark:bg-zinc-900/70 shadow px-4 py-3 rounded-2xl text-zinc-700 dark:text-zinc-200 text-sm">
                Loading chat…
              </div>
            </div>
          )}

          <div className="space-y-4 pr-1 max-h-[60vh] overflow-y-auto scroll-smooth">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} />
            ))}

            {isSending && (
              <div className="slide-in-from-bottom-1 flex justify-start animate-in duration-200 fade-in">
                <div className="bg-zinc-100/80 dark:bg-zinc-900/70 backdrop-blur px-4 py-3 rounded-2xl text-zinc-700 dark:text-zinc-200 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="bg-zinc-400 rounded-full w-2 h-2 animate-pulse" />
                    Thinking…
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-white/80 dark:bg-zinc-950/70 px-4 py-3 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl focus:outline-none focus:ring-4 focus:ring-zinc-300/30 dark:focus:ring-zinc-700/30 text-sm resize-none"
              rows={2}
              disabled={isSending || loadingChat}
            />

            <button
              onClick={() => void sendMessage()}
              disabled={!canSend}
              className="bg-zinc-900 dark:bg-zinc-50 disabled:opacity-50 px-4 py-3 rounded-2xl font-medium text-white dark:text-zinc-900 text-sm active:scale-[0.98] transition"
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>

        <p className="mt-3 text-zinc-500 dark:text-zinc-400 text-xs text-center">
          Your messages are sent to the backend API.
        </p>
      </main>
    </div>
  );
}

function MessageBubble({ role, content }: { role: Role; content: string }) {
  const isUser = role === "user";

  return (
    <div
      className={[
        "flex transform-gpu",
        "animate-in fade-in slide-in-from-bottom-1 duration-200",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
          "transition-transform duration-200",
          isUser
            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            : "bg-zinc-100/80 text-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 shadow-[0_10px_24px_rgba(0,0,0,0.06)]",
        ].join(" ")}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="dark:prose-invert max-w-none prose prose-zinc prose-sm">
            <div className="overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
