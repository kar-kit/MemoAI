// app/dashboard/chat/_types/chat.ts
export type Role = "user" | "assistant" | "system";

export type DeckCreatedAction = {
  type: "deck_created";
  deck_id: string;
  title: string;
  card_count: number;
  preview_cards?: { front: string; back: string }[];
};

export type ChatAction = {
  type: "deck_created";
  deck_id: string;
  title: string;
  card_count: number;
  preview_cards?: { front: string; back: string }[];
} | null;

export type Attachment = {
  name: string;
  size: number;
  mime: string;
} | null;

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  action?: ChatAction;
  attachment?: Attachment;
};

export type ChatDetailResponse = {
  chat_id: string;
  title: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    action?: ChatAction;
    attachment?: Attachment;
  }[];
};

export type AttachmentMeta = {
  name: string;
  size?: number;
  mime?: string;
};

export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

// Backend shapes (match FastAPI)
export type ChatsListItem = {
  chat_id: string;
  title: string;
  updated_at: string;
};

export type ChatDetailMessage = {
  role: Exclude<Role, "system">; // backend only sends user/assistant
  content: string;
};

export function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const DEFAULT_ASSISTANT: ChatMessage = {
  id: uid(),
  role: "assistant",
  content: "Hey — send me a message and I’ll reply.",
};
