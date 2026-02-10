"use client";

import type { ChatMessage, ChatSummary } from "../_types/chat";

import MessageBubble from "./MessageBubble";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ChatLayout(props: {
  mounted: boolean;
  chats: ChatSummary[];
  activeChatId: string | null;
  loadingChat: boolean;
  messages: ChatMessage[];
  isSending: boolean;
  input: string;
  setInput: (v: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  onNewChat: () => void;
  onLoadChat: (chatId: string) => void;
  onSend: () => void;
  canSend: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  const {
    mounted,
    chats,
    activeChatId,
    loadingChat,
    messages,
    isSending,
    input,
    setInput,
    file,
    setFile,
    onNewChat,
    onLoadChat,
    onSend,
    canSend,
    onKeyDown,
    bottomRef,
  } = props;

  return (
    <div className="relative bg-[#070A12] h-screen overflow-hidden text-white">
      {/* Indigo branded backdrop (matches deck editor) */}
      <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_30%_-200px,rgba(99,102,241,0.30),transparent_60%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.22),transparent_55%),radial-gradient(700px_circle_at_15%_60%,rgba(56,189,248,0.10),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.10] pointer-events-none [background-image:radial-gradient(rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/80 pointer-events-none" />

      <div className="z-10 relative flex h-full">
        {/* Sidebar */}
        <aside className="hidden md:flex md:flex-col bg-black/25 backdrop-blur-xl border-white/10 border-r w-[300px] shrink-0">
          <div className="p-4">
            <button
              onClick={onNewChat}
              className="bg-indigo-500 hover:bg-indigo-400 shadow-[0_10px_25px_rgba(79,70,229,0.25)] px-4 py-2.5 rounded-2xl w-full font-semibold text-white text-sm active:scale-[0.98] transition"
            >
              + New chat
            </button>

            <div className="bg-white/[0.04] mt-4 p-3 border border-white/10 rounded-2xl">
              <div className="font-semibold text-white/70 text-xs">MemoAI</div>
              <div className="mt-1 text-white/45 text-xs">
                Keep sessions short — consistency beats cramming.
              </div>
            </div>
          </div>

          <div className="flex-1 px-2 pb-4 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="px-3 py-2 text-white/45 text-xs">
                No chats yet
              </div>
            ) : (
              <div className="space-y-1">
                {chats.map((chat) => {
                  const active = activeChatId === chat.id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => onLoadChat(chat.id)}
                      className={cx(
                        "w-full rounded-xl px-3 py-2 text-left transition",
                        "border border-transparent hover:border-white/10 hover:bg-white/5",
                        active && "border-indigo-400/25 bg-indigo-500/10",
                      )}
                    >
                      <div className="font-medium text-white/90 text-sm truncate">
                        {chat.title || "New chat"}
                      </div>
                      <div className="mt-0.5 text-white/45 text-xs">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main
          className={cx(
            "flex min-w-0 flex-1 flex-col px-5 py-6 md:px-8",
            "transition-all duration-700 ease-out",
            mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
          {/* Top bar */}
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="text-white/50 text-xs">Dashboard / Chat</div>
              <div className="mt-1 font-semibold text-xl truncate tracking-tight">
                Chat
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:block bg-white/5 px-3 py-1 border border-white/10 rounded-full text-white/60 text-xs">
                Enter to send · Shift+Enter newline
              </div>
            </div>
          </div>

          {/* Chat panel */}
          <div className="relative flex flex-col flex-1 bg-white/[0.04] shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl mt-5 border border-white/10 rounded-3xl min-h-0 overflow-hidden">
            <div className="absolute inset-0 rounded-3xl ring-1 ring-white/10 pointer-events-none" />

            {loadingChat && (
              <div className="z-20 absolute inset-0 place-items-center grid bg-black/35 backdrop-blur-sm">
                <div className="bg-black/40 px-4 py-3 border border-white/10 rounded-2xl text-white/80 text-sm animate-in duration-200 fade-in zoom-in-95">
                  Loading chat…
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 px-4 md:px-6 py-5 min-h-0 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    action={m.action}
                    attachment={m.attachment}
                    // nice stagger on mount for the initial assistant
                    animateDelayMs={Math.min(i * 20, 180)}
                  />
                ))}

                {isSending && (
                  <div className="slide-in-from-bottom-2 animate-in duration-200 fade-in">
                    <div className="inline-flex items-center gap-2 bg-white/[0.04] px-4 py-3 border border-white/10 rounded-2xl text-white/70 text-sm">
                      <span className="inline-flex items-center gap-1">
                        <span className="bg-white/40 rounded-full w-1.5 h-1.5 animate-bounce [animation-delay:0ms]" />
                        <span className="bg-white/40 rounded-full w-1.5 h-1.5 animate-bounce [animation-delay:120ms]" />
                        <span className="bg-white/40 rounded-full w-1.5 h-1.5 animate-bounce [animation-delay:240ms]" />
                      </span>
                      Thinking…
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Composer */}
            <div className="bg-black/20 p-4 md:p-5 border-white/10 border-t">
              <div className="flex flex-col gap-3">
                {/* Attach row */}
                <div className="flex justify-between items-center gap-3">
                  <label className="group inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 border border-white/10 rounded-full text-white/80 text-sm active:scale-[0.98] transition cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.ppt,.pptx"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      disabled={isSending || loadingChat}
                    />
                    <span className="group-hover:-rotate-6 transition-transform duration-200">
                      📎
                    </span>
                    Attach PDF/PPT
                  </label>

                  {file ? (
                    <div className="flex items-center gap-2 text-white/60 text-xs animate-in duration-200 fade-in">
                      <span className="max-w-[220px] truncate">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        disabled={isSending || loadingChat}
                        className="bg-white/5 hover:bg-white/10 px-2 py-1 border border-white/10 rounded-full text-white/70 active:scale-[0.98] transition"
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className="text-white/40 text-xs">Optional</span>
                  )}
                </div>

                {/* Input row */}
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Type a message…"
                    disabled={isSending || loadingChat}
                    rows={2}
                    className={cx(
                      "min-h-[52px] flex-1 resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition",
                      "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35",
                      "focus:border-indigo-400/30 focus:ring-4 focus:ring-indigo-500/15",
                      (isSending || loadingChat) && "opacity-60",
                    )}
                  />

                  <button
                    onClick={onSend}
                    disabled={!canSend}
                    className={cx(
                      "rounded-2xl px-5 py-3 text-sm font-semibold transition active:scale-[0.98]",
                      canSend
                        ? "bg-indigo-500 text-white hover:bg-indigo-400"
                        : "cursor-not-allowed bg-white/10 text-white/40",
                    )}
                  >
                    {isSending ? "Sending…" : "Send"}
                  </button>
                </div>

                <div className="text-[11px] text-white/35 text-center">
                  Your messages are sent to the backend API.
                </div>
              </div>
            </div>
          </div>

          {/* Mobile bottom spacing */}
          <div className="h-2" />
        </main>
      </div>
    </div>
  );
}
