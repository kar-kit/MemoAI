// app/dashboard/chat/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChatLayout from "./_components/ChatLayout";
import type { ChatMessage } from "./_types/chat";
import { DEFAULT_ASSISTANT, uid } from "./_types/chat";
import { useChatList } from "./_hooks/useChatList";

import {
  dispatchStream,
  dispatchStreamWithFile,
  type SSETypedEvent,
  type Message as BackendMessage,
} from "@/lib/api/llm";

export default function ChatPage() {
  const [mounted, setMounted] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_ASSISTANT]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [file, setFile] = useState<File | null>(null);

  const {
    chats,
    activeChatId,
    loadingChat,
    refreshChats,
    startNewChat,
    loadChat,
    setActiveChatId,
    setChats,
  } = useChatList(setMessages);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, loadingChat]);

  useEffect(() => {
    void refreshChats();
  }, [refreshChats]);

  const canSend = useMemo(() => {
    return !isSending && Boolean(input.trim()) && !loadingChat;
  }, [isSending, input, loadingChat]);

  const onNewChat = useCallback(async () => {
    const id = await startNewChat();
    if (!id) return;

    setActiveChatId(id);
    setMessages([DEFAULT_ASSISTANT]);
    setChats((prev) => prev);
  }, [setActiveChatId, setChats, startNewChat]);

  function toBackendMessages(msgs: ChatMessage[]): BackendMessage[] {
    return msgs
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending || loadingChat) return;

    let chatId = activeChatId;
    if (!chatId) {
      chatId = await startNewChat();
      if (!chatId) return;
      setActiveChatId(chatId);
      setMessages([DEFAULT_ASSISTANT]);
    }

    const attachment = file
      ? { name: file.name, size: file.size, mime: file.type }
      : null;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      attachment,
    };

    // optimistic UI
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    const systemId = uid();
    const assistantId = uid();

    setMessages((prev) => [
      ...prev,
      { id: systemId, role: "system", content: "Working…" },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const handleEvent = (evt: SSETypedEvent) => {
      if (evt.type === "status") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === systemId ? { ...m, content: evt.message } : m,
          ),
        );
        return;
      }

      if (evt.type === "token") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + evt.token } : m,
          ),
        );
        return;
      }

      if (evt.type === "done") {
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== systemId)
            .map((m) => {
              if (m.id !== assistantId) return m;

              const finalContent =
                typeof evt.response === "string" &&
                evt.response.trim().length > 0
                  ? evt.response
                  : m.content;

              return {
                ...m,
                content: finalContent,
                action: evt.action ?? m.action,
              };
            }),
        );
      }
    };

    const handleError = (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : "Sorry — something went wrong while streaming.";

      setMessages((prev) =>
        prev
          .filter((m) => m.id !== systemId)
          .map((m) => (m.id === assistantId ? { ...m, content: msg } : m)),
      );

      console.error("Dispatch stream error:", err);
    };

    try {
      const payload = {
        chat_id: chatId,
        messages: toBackendMessages([...messages, userMsg]),
      };

      if (file) {
        const stream = dispatchStreamWithFile(
          { chat_id: chatId, message: trimmed, file },
          { onEvent: handleEvent, onError: handleError, onClose: () => {} },
        );
        setFile(null);
        void stream;
      } else {
        const stream = dispatchStream(payload, {
          onEvent: handleEvent,
          onError: handleError,
          onClose: () => {},
        });
        void stream;
      }

      setTimeout(() => void refreshChats(), 300);
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
    <ChatLayout
      mounted={mounted}
      chats={chats}
      activeChatId={activeChatId}
      loadingChat={loadingChat}
      messages={messages}
      isSending={isSending}
      input={input}
      setInput={setInput}
      file={file}
      setFile={setFile}
      onNewChat={() => void onNewChat()}
      onLoadChat={(id) => void loadChat(id)}
      onSend={() => void sendMessage()}
      canSend={canSend}
      onKeyDown={onKeyDown}
      bottomRef={bottomRef}
    />
  );
}
