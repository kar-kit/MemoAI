/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { AttachmentMeta, Role } from "../_types/chat";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function AttachmentPill({ attachment }: { attachment: AttachmentMeta }) {
  const ext = attachment.name.split(".").pop()?.toUpperCase() ?? "";
  const isPdf = ext === "PDF";
  const isPpt = ext === "PPT" || ext === "PPTX";

  return (
    <div
      className={cx(
        "mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        "border-white/10 bg-white/5 text-white/80",
      )}
      title={attachment.name}
    >
      <span className="text-sm leading-none">📎</span>
      <span className="max-w-[220px] font-medium truncate">
        {attachment.name}
      </span>

      {(isPdf || isPpt) && (
        <span className="bg-white/10 ml-1 px-2 py-0.5 rounded-full font-semibold text-[10px]">
          {ext}
        </span>
      )}
    </div>
  );
}

export default function MessageBubble(props: {
  role: Role;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action?: any;
  attachment?: AttachmentMeta | null;
  animateDelayMs?: number;
}) {
  const { role, content, action, attachment, animateDelayMs = 0 } = props;
  const isUser = role === "user";
  const isSystem = role === "system";

  const wrapAlign = isUser ? "justify-end" : "justify-start";

  const bubbleBase =
    "rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl";

  const userBubble = cx(
    "border-white/10 bg-indigo-500/12 text-white",
    "ring-1 ring-indigo-400/15",
  );

  const assistantBubble = cx("border-white/10 bg-white/[0.04] text-white/90");

  const systemBubble = cx("border-white/10 bg-black/25 text-white/70 italic");

  return (
    <div
      className={cx(
        "flex",
        wrapAlign,
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
      style={{ animationDelay: `${animateDelayMs}ms` }}
    >
      <div
        className={cx(isUser ? "max-w-[560px]" : "max-w-[760px]", "min-w-0")}
      >
        <div
          className={cx(
            bubbleBase,
            isUser ? userBubble : isSystem ? systemBubble : assistantBubble,
          )}
        >
          {isUser || isSystem ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <div className="prose-invert max-w-none prose-a:text-indigo-300 prose-p:leading-relaxed prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* attachment under USER message */}
        {isUser && attachment?.name && (
          <AttachmentPill attachment={attachment} />
        )}

        {/* deck preview under ASSISTANT message */}
        {action?.type === "deck_created" && (
          <div className="bg-white/[0.04] backdrop-blur-xl mt-3 p-4 border border-white/10 rounded-3xl animate-in duration-200 fade-in zoom-in-95">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-white/95 text-sm truncate">
                  {action.title}
                </div>
                <div className="mt-1 text-white/55 text-xs">
                  {action.card_count} cards • Deck created
                </div>
              </div>

              {action?.deck_id ? (
                <Link
                  href={`/dashboard/decks/${action.deck_id}`}
                  className="bg-indigo-500 hover:bg-indigo-400 px-3 py-2 rounded-xl font-semibold text-white text-xs active:scale-[0.98] transition shrink-0"
                >
                  View deck
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="bg-white/10 px-3 py-2 rounded-xl font-semibold text-white/45 text-xs cursor-not-allowed shrink-0"
                  title="Deck not ready yet"
                >
                  View deck
                </button>
              )}
            </div>

            {Array.isArray(action.preview_cards) &&
            action.preview_cards.length > 0 ? (
              <div className="space-y-2 mt-3">
                {action.preview_cards.slice(0, 3).map((c: any, i: number) => (
                  <div
                    key={`${action.deck_id}-${i}`}
                    className="bg-black/20 p-3 border border-white/10 rounded-2xl"
                  >
                    <div className="font-semibold text-[11px] text-white/45 tracking-wide">
                      Q
                    </div>
                    <div className="mt-1 text-white/90 text-sm whitespace-pre-wrap">
                      {c.front}
                    </div>

                    <div className="mt-3 font-semibold text-[11px] text-white/45 tracking-wide">
                      A
                    </div>
                    <div className="mt-1 text-white/80 text-sm whitespace-pre-wrap">
                      {c.back}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
