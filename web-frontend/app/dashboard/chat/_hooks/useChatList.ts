// app/dashboard/chat/_hooks/useChatList.ts
"use client";

import type {
  ChatDetailResponse,
  ChatMessage,
  ChatSummary,
  ChatsListItem,
} from "../_types/chat";
import { useCallback, useState } from "react";

import { uid } from "../_types/chat";

export function useChatList(setMessages: (msgs: ChatMessage[]) => void) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);

  const API_URL = "/api/proxy";

  const refreshChats = useCallback(async () => {
    const res = await fetch(`${API_URL}/llm/chats`, { credentials: "include" });
    if (!res.ok) return;

    const data = (await res.json()) as ChatsListItem[];
    const mapped: ChatSummary[] = data.map((c) => ({
      id: c.chat_id,
      title: c.title,
      updatedAt: c.updated_at,
    }));

    setChats(mapped);

    if (!activeChatId && mapped.length > 0) {
      setActiveChatId(mapped[0].id);
    }
  }, [activeChatId]);

  const startNewChat = useCallback(async () => {
    const res = await fetch(`${API_URL}/llm/chats`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
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
    setChats((prev) => [newChat, ...prev.filter((c) => c.id !== newChat.id)]);

    return newChat.id;
  }, []);

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
            action: m.action ?? null,
            attachment: m.attachment ?? null,
          })),
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingChat(false);
      }
    },
    [setMessages],
  );

  return {
    API_URL,
    chats,
    setChats,
    activeChatId,
    setActiveChatId,
    loadingChat,
    refreshChats,
    startNewChat,
    loadChat,
  };
}
