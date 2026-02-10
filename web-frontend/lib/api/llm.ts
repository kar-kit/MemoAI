// lib/api/llm.ts
import { ApiError, apiFetch } from "./client";

export type Role = "user" | "assistant" | "system";

export type Message = {
  role: "user" | "assistant";
  content: string;
  action?: {
    type: "deck_created";
    deck_id: string;
    title: string;
    card_count: number;
    preview_cards?: { front: string; back: string }[];
  } | null;
  attachment?: {
    name: string;
    size: number;
    mime: string;
  } | null;
};

export type ChatSummary = {
  chat_id: string;
  title: string;
  updated_at: string;
};

export type ChatDetail = {
  chat_id: string;
  title: string;
  messages: Message[];
};

// ----- Deck action payload from backend -----
export type DeckCreatedAction = {
  type: "deck_created";
  deck_id: string;
  title: string;
  card_count: number;
  preview_cards: { front: string; back: string }[];
};

export type DispatchResponse = {
  response: string;
  action: DeckCreatedAction | null;
};

export type DispatchRequest = {
  chat_id: string;
  messages: Message[];
};

// ----- Chats -----
export async function createChat() {
  return apiFetch<{ chat_id: string; title: string; updated_at: string }>(
    "/llm/chats",
    { method: "POST" },
  );
}

export async function listChats() {
  return apiFetch<ChatSummary[]>("/llm/chats", { method: "GET" });
}

export async function getChat(chat_id: string) {
  return apiFetch<ChatDetail>(`/llm/chats/${chat_id}`, { method: "GET" });
}

// ----- Non-stream dispatch -----
export async function dispatch(payload: DispatchRequest) {
  return apiFetch<DispatchResponse>("/llm/dispatch", {
    method: "POST",
    json: payload,
  });
}

// ----- Dispatch with file (multipart, non-stream) -----
export async function dispatchWithFile(opts: {
  chat_id: string;
  message: string;
  file: File;
}) {
  const form = new FormData();
  form.append("chat_id", opts.chat_id);
  form.append("message", opts.message);
  form.append("file", opts.file);

  // IMPORTANT: do NOT set Content-Type when sending FormData; browser sets boundary.
  return apiFetch<DispatchResponse>("/llm/dispatch/with-file", {
    method: "POST",
    body: form,
  });
}

// ----- SSE types -----
export type SSEStatusEvent = {
  type: "status";
  stage: string;
  message: string;
};

export type SSEDoneEvent = {
  type: "done";
  response: string;
  action: DeckCreatedAction | null;
};

export type SSETypedEvent =
  | { type: "token"; token: string } // if you ever forward token events
  | SSEStatusEvent
  | SSEDoneEvent;

// ----- Streaming dispatch (SSE over fetch) -----
export function dispatchStream(
  payload: DispatchRequest,
  handlers: {
    onEvent: (evt: SSETypedEvent) => void;
    onError?: (err: unknown) => void;
    onClose?: () => void;
  },
) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000"}/llm/dispatch/stream`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        // Try to read error body for debugging
        let msg = `Stream request failed (${res.status})`;
        try {
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            msg =
              (data?.detail && String(data.detail)) ||
              (data?.message && String(data.message)) ||
              msg;
          } else {
            msg = (await res.text()) || msg;
          }
        } catch {}
        throw new ApiError(msg, res.status);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body for SSE stream");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames end with \n\n
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          // We only care about "data: ..."
          const lines = rawEvent.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const dataStr = line.replace(/^data:\s?/, "").trim();
            if (!dataStr) continue;

            try {
              const evt = JSON.parse(dataStr) as SSETypedEvent;
              handlers.onEvent(evt);
            } catch {
              // ignore malformed chunks
            }
          }
        }
      }

      handlers.onClose?.();
    } catch (err) {
      // Abort isn't really an "error"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.name === "AbortError") {
        handlers.onClose?.();
        return;
      }
      handlers.onError?.(err);
    }
  })();

  return {
    close: () => controller.abort(),
  };
}

// ----- Streaming dispatch with file (SSE + multipart) -----
// NOTE: true streaming + multipart is tricky in browsers because fetch streaming works,
// but some proxies/bodies may buffer. This still works for local dev.
export function dispatchStreamWithFile(
  opts: { chat_id: string; message: string; file: File },
  handlers: {
    onEvent: (evt: SSETypedEvent) => void;
    onError?: (err: unknown) => void;
    onClose?: () => void;
  },
) {
  const controller = new AbortController();

  (async () => {
    try {
      const form = new FormData();
      form.append("chat_id", opts.chat_id);
      form.append("message", opts.message);
      form.append("file", opts.file);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000"}/llm/dispatch/stream/with-file`,
        {
          method: "POST",
          credentials: "include",
          body: form,
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        let msg = `Stream request failed (${res.status})`;
        try {
          msg = (await res.text()) || msg;
        } catch {}
        throw new ApiError(msg, res.status);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body for SSE stream");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const lines = rawEvent.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const dataStr = line.replace(/^data:\s?/, "").trim();
            if (!dataStr) continue;

            try {
              const evt = JSON.parse(dataStr) as SSETypedEvent;
              handlers.onEvent(evt);
            } catch {}
          }
        }
      }

      handlers.onClose?.();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.name === "AbortError") {
        handlers.onClose?.();
        return;
      }
      handlers.onError?.(err);
    }
  })();

  return { close: () => controller.abort() };
}
