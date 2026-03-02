// app/dashboard/survey/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import BackButton from "../_components/BackButton";
import { useRouter } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Group = "A" | "B";

type ChecklistItem = {
  id: string;
  title: string;
  description?: string;
};

const STORAGE_KEY = "memoai_survey_checklist_v1";

// Step 8 gate (must be checked to enable Take survey)
const STEP_8_ID = "ready-for-survey";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getChecklist(group: Group | null): ChecklistItem[] {
  // If group not selected yet, keep generic labels (and you can disable interaction)
  const w1IsManual = group === "A";
  const w2IsManual = group === "B";

  const w1Title = w1IsManual
    ? "Workflow 1 (Manual): Create ~10 flashcards"
    : "Workflow 1 (AI): Generate ~10 flashcards in Chat with MemoAI";

  const w1Desc = w1IsManual
    ? "Create a deck manually from the provided study material."
    : "Use the chat feature to generate a deck from the same study material.";

  const w2Title = w2IsManual
    ? "Workflow 2 (Manual): Create ~10 flashcards"
    : "Workflow 2 (AI): Generate ~10 flashcards in Chat with MemoAI";

  const w2Desc = w2IsManual
    ? "Now switch method and create a second deck manually (~10 cards)."
    : "Now switch method and generate a second deck using MemoAI (~10 cards).";

  return [
    {
      id: "received-material",
      title: "Received the sample PDF/PPT study material",
      description:
        "Use the provided document as the source for both workflows.",
    },
    {
      id: "workflow-1-create",
      title: group ? w1Title : "Workflow 1: Create ~10 flashcards",
      description: group
        ? w1Desc
        : "Once you select your group, this step will update to match your order.",
    },
    {
      id: "workflow-1-review",
      title: "Review + refine Deck 1",
      description:
        "If AI-generated, manually check accuracy and clarity before studying.",
    },
    {
      id: "workflow-1-study",
      title: "Study Deck 1 using the spaced-repetition interface",
      description:
        "Use the normal study flow so comparisons are fair (keep it short and consistent).",
    },
    {
      id: "workflow-2-create",
      title: group ? w2Title : "Workflow 2: Complete the alternative method",
      description: group
        ? w2Desc
        : "Once you select your group, this step will update to match your order.",
    },
    {
      id: "workflow-2-review",
      title: "Review + refine Deck 2",
      description:
        "Ensure cards are accurate, atomic, and clear before studying.",
    },
    {
      id: "workflow-2-study",
      title: "Study Deck 2 using the same spaced-repetition interface",
      description:
        "Use the same study approach as Deck 1 so the comparison is consistent.",
    },
    {
      id: STEP_8_ID,
      title: "Finished both workflows (ready to take the survey)",
      description:
        "Tick this once you’ve completed Deck 1 + Deck 2 creation, review, and study.",
    },
  ];
}

export default function SurveyPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // entrance animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  // hydrate persisted state
  useEffect(() => {
    const saved = safeParse<{
      group?: Group | null;
      checked?: Record<string, boolean>;
    }>(
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null,
    );

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved?.group) setGroup(saved.group);
    if (saved?.checked) setChecked(saved.checked);
  }, []);

  // persist changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ group, checked }),
    );
  }, [group, checked]);

  const checklist = useMemo(() => getChecklist(group), [group]);

  const completedCount = useMemo(() => {
    return checklist.reduce((acc, item) => acc + (checked[item.id] ? 1 : 0), 0);
  }, [checked, checklist]);

  const progressPct = useMemo(() => {
    if (!checklist.length) return 0;
    return Math.round((completedCount / checklist.length) * 100);
  }, [completedCount, checklist.length]);

  const canTakeSurvey = !!checked[STEP_8_ID];

  function toggle(id: string) {
    // Don’t allow ticking steps before picking a group (keeps it clearer)
    if (!group) return;
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetAll() {
    setGroup(null);
    setChecked({});
  }

  return (
    <div className="relative px-6 min-h-screen overflow-hidden text-[var(--app-fg)]">
      {/* Backdrop (match dashboard indigo vibe) */}
      <div className="absolute inset-0 bg-zinc-50 dark:bg-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(99,102,241,0.18),transparent_60%),radial-gradient(900px_circle_at_20%_20%,rgba(129,140,248,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(79,70,229,0.12),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.10] pointer-events-none [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 dark:from-black/40 via-transparent to-zinc-50/70 dark:to-black/60 pointer-events-none" />

      <main
        className={cx(
          "relative mx-auto max-w-3xl py-12",
          "transform-gpu transition-all duration-700 ease-out",
          mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <BackButton />

        <div className="mt-8">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 px-3 py-1 border border-indigo-500/15 rounded-full font-semibold text-indigo-700 dark:text-indigo-300 text-xs">
            Study Session Checklist
          </div>

          <h1 className="mt-4 font-semibold text-zinc-900 dark:text-zinc-50 text-3xl tracking-tight">
            User Survey
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Select your group, then tick each step as you go. Your progress is
            saved automatically.
          </p>
        </div>

        {/* Progress + Group */}
        <div className="bg-white/65 dark:bg-zinc-950/50 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl mt-8 p-5 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <div className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                Progress
              </div>
              <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-xs">
                {completedCount} / {checklist.length} steps completed
              </div>
            </div>

            <button
              type="button"
              onClick={resetAll}
              className={cx(
                "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold",
                "border-zinc-300/80 bg-white/80 text-zinc-900 hover:bg-white",
                "dark:border-zinc-700/70 dark:bg-zinc-950/40 dark:text-zinc-50 dark:hover:bg-zinc-950/60",
                "transition active:translate-y-[1px]",
                "focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
              )}
            >
              Reset
            </button>
          </div>

          <div className="mt-4">
            <div className="bg-zinc-200/60 dark:bg-zinc-800/60 rounded-full w-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-full h-2 transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 text-zinc-500 dark:text-zinc-400 text-xs">
              {progressPct}%
            </div>
          </div>

          {/* Group selection */}
          <div className="bg-white/60 dark:bg-zinc-950/40 mt-6 p-4 border border-zinc-200/70 dark:border-zinc-800/70 rounded-xl">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                  Group allocation
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-xs">
                  This will update the workflow steps so it’s obvious what comes
                  first.
                </div>
              </div>

              {group ? (
                <div className="bg-indigo-500/10 px-2.5 py-1 border border-indigo-500/20 rounded-full font-semibold text-[11px] text-indigo-700 dark:text-indigo-300 shrink-0">
                  Group {group}
                </div>
              ) : null}
            </div>

            <div className="gap-2 grid grid-cols-1 sm:grid-cols-2 mt-3">
              {(["A", "B"] as Group[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  className={cx(
                    "flex items-start gap-3 rounded-xl border px-4 py-3 text-left",
                    "transition active:scale-[0.99]",
                    "focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
                    group === g
                      ? "border-indigo-500/30 bg-indigo-500/10"
                      : "border-zinc-200/70 bg-white/70 hover:bg-white dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60",
                  )}
                >
                  <span
                    className={cx(
                      "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border",
                      group === g
                        ? "border-indigo-500/40 bg-indigo-500/15"
                        : "border-zinc-300/70 bg-white/70 dark:border-zinc-700/70 dark:bg-zinc-950/40",
                    )}
                    aria-hidden
                  >
                    <span
                      className={cx(
                        "h-2 w-2 rounded-full",
                        group === g
                          ? "bg-indigo-600 dark:bg-indigo-400"
                          : "bg-transparent",
                      )}
                    />
                  </span>

                  <span className="min-w-0">
                    <span className="block font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                      Group {g}
                    </span>
                    <span className="block mt-0.5 text-zinc-600 dark:text-zinc-400 text-xs">
                      {g === "A"
                        ? "Manual first → AI-assisted second"
                        : "AI-assisted first → Manual second"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white/65 dark:bg-zinc-950/50 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl mt-6 p-6 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl">
          <div className="flex justify-between items-center gap-3">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-base">
              Session steps
            </h2>
            <div className="text-zinc-500 dark:text-zinc-400 text-xs">
              {group ? "Saved automatically" : "Select a group to start"}
            </div>
          </div>

          <div className={cx("mt-4 space-y-2", !group && "opacity-60")}>
            {checklist.map((item, idx) => {
              const isOn = !!checked[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  disabled={!group}
                  className={cx(
                    "w-full rounded-xl border px-4 py-3 text-left",
                    "transition",
                    "focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
                    !group && "cursor-not-allowed",
                    isOn
                      ? "border-emerald-500/25 bg-emerald-500/10"
                      : "border-zinc-200/70 bg-white/70 hover:bg-white dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60",
                  )}
                  aria-pressed={isOn}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cx(
                        "mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border",
                        isOn
                          ? "border-emerald-500/30 bg-emerald-500/15"
                          : "border-zinc-300/70 bg-white/70 dark:border-zinc-700/70 dark:bg-zinc-950/40",
                      )}
                      aria-hidden
                    >
                      {isOn ? (
                        <span className="font-black text-[12px] text-emerald-700 dark:text-emerald-300 leading-none">
                          ✓
                        </span>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="flex justify-between items-baseline gap-3">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                          {idx + 1}. {item.title}
                        </div>
                      </div>
                      {item.description ? (
                        <div className="mt-1 text-zinc-600 dark:text-zinc-400 text-xs">
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Take survey CTA (enabled only after step 8 is checked) */}
          <div className="flex justify-end items-center mt-6">
            <button
              type="button"
              disabled={!canTakeSurvey}
              onClick={() => {
                if (!canTakeSurvey) return;
                // Change this route to wherever your actual questionnaire lives
                router.push("/dashboard/survey/questions");
              }}
              className={cx(
                "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                "focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
                canTakeSurvey
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-[0_10px_25px_rgba(79,70,229,0.22)] hover:from-indigo-600 hover:to-indigo-400 hover:shadow-[0_12px_28px_rgba(79,70,229,0.28)] active:translate-y-[1px] active:scale-[0.99]"
                  : "cursor-not-allowed border border-zinc-300/70 bg-zinc-200/50 text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-800/40 dark:text-zinc-400",
              )}
              title={
                canTakeSurvey
                  ? "Take the post-session survey"
                  : "Complete step 8 to unlock the survey"
              }
            >
              Take survey
            </button>
          </div>

          <div className="mt-4 text-zinc-500 dark:text-zinc-400 text-xs">
            Note: No audio, video, or screen recording is collected. Only your
            checklist progress and normal app interaction data required for
            functionality are stored.
          </div>
        </div>
      </main>
    </div>
  );
}
