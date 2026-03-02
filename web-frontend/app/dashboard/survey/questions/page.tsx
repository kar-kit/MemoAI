// app/dashboard/survey/questions/page.tsx
"use client";

import { ApiError, apiFetch } from "@/lib/api/client";
import { useEffect, useMemo, useState } from "react";

import BackButton from "../../_components/BackButton";
import { useRouter } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Likert = 1 | 2 | 3 | 4 | 5;

type Question = {
  id: string; // e.g. "q1"
  text: string;
};

type Section = {
  title: string;
  description?: string;
  questions: Question[];
};

const LIKERT_LABELS: Record<Likert, string> = {
  1: "Strongly Disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly Agree",
};

const SECTIONS: Section[] = [
  {
    title: "Section A – Manual Flashcard Creation",
    questions: [
      {
        id: "q1",
        text: "Manually creating the flashcard deck required a high level of effort.",
      },
      {
        id: "q2",
        text: "I found the process of manually creating flashcards time-consuming.",
      },
      {
        id: "q3",
        text: "I felt that a significant amount of preparation was required before I could begin studying the manually created deck.",
      },
    ],
  },
  {
    title: "Section B – AI-Assisted Flashcard Creation",
    questions: [
      {
        id: "q4",
        text: "Using the AI feature to generate flashcards required less effort than creating them manually.",
      },
      {
        id: "q5",
        text: "The AI-assisted process reduced the time needed to prepare before studying.",
      },
      {
        id: "q6",
        text: "Reviewing and refining the AI-generated flashcards required less effort than creating flashcards from scratch.",
      },
      {
        id: "q7",
        text: "I was able to begin studying more quickly when using the AI-generated deck compared to the manually created deck.",
      },
    ],
  },
  {
    title: "Section C – Spaced-Repetition Review Experience",
    questions: [
      {
        id: "q8",
        text: "The process of studying flashcards using the spaced-repetition system was clear and easy to follow.",
      },
      {
        id: "q9",
        text: "Rating my recall confidence during review felt intuitive and required little effort.",
      },
    ],
  },
  {
    title: "Section D – Overall Perceived Effort and Adoption",
    questions: [
      {
        id: "q10",
        text: "Overall, the AI-assisted process made using spaced repetition feel less effortful compared to manual creation.",
      },
      {
        id: "q11",
        text: "I would be more likely to use a spaced-repetition system regularly if it included AI-assisted flashcard generation.",
      },
    ],
  },
];

const ALL_QUESTION_IDS = SECTIONS.flatMap((s) => s.questions.map((q) => q.id));

export default function SurveyQuestionsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Likert | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const answeredCount = useMemo(() => {
    return ALL_QUESTION_IDS.reduce((acc, id) => acc + (answers[id] ? 1 : 0), 0);
  }, [answers]);

  const canSubmit =
    answeredCount === ALL_QUESTION_IDS.length && !submitting && !submitted;

  function setAnswer(qid: string, v: Likert) {
    setAnswers((prev) => ({ ...prev, [qid]: v }));
  }

  async function onSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const payload = {
        submitted_at: new Date().toISOString(),
        answers, // { q1: 4, q2: 5, ... }
      };

      // ✅ Uses your SDK: handles base URL + cookies + FastAPI errors
      await apiFetch<{ survey_response_id: string }>("/survey/responses", {
        method: "POST",
        json: payload,
      });

      setSubmitted(true);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong submitting the survey.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative px-6 min-h-screen overflow-hidden text-[var(--app-fg)]">
      {/* Backdrop (same dashboard vibe) */}
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
            Post-session questionnaire
          </div>

          <div className="flex justify-between items-start gap-4 mt-4">
            <div className="min-w-0">
              <h1 className="font-semibold text-zinc-900 dark:text-zinc-50 text-3xl tracking-tight">
                Survey
              </h1>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Please answer every statement once. There’s no back-and-forth —
                submit when complete.
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="text-zinc-500 dark:text-zinc-400 text-xs">
                Completed
              </div>
              <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                {answeredCount}/{ALL_QUESTION_IDS.length}
              </div>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="bg-emerald-500/10 dark:bg-emerald-500/10 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl mt-8 p-6 border border-emerald-500/25 rounded-2xl">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-lg">
              Thanks — survey submitted ✅
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm">
              You can close this page now.
            </p>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className={cx(
                  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium",
                  "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white",
                  "shadow-[0_10px_25px_rgba(79,70,229,0.22)] hover:shadow-[0_12px_28px_rgba(79,70,229,0.28)]",
                  "transition active:translate-y-[1px] active:scale-[0.99]",
                  "focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
                )}
              >
                Back to dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Questions */}
            <div className="space-y-6 mt-8">
              {SECTIONS.map((section) => (
                <div
                  key={section.title}
                  className="bg-white/65 dark:bg-zinc-950/50 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl p-6 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl"
                >
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-base">
                    {section.title}
                  </h2>

                  <div className="space-y-4 mt-4">
                    {section.questions.map((q) => {
                      const value = answers[q.id] ?? null;

                      return (
                        <div
                          key={q.id}
                          className="bg-white/70 dark:bg-zinc-950/40 p-4 border border-zinc-200/70 dark:border-zinc-800/70 rounded-xl"
                        >
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                            {q.id.replace("q", "")}. {q.text}
                          </div>

                          <div className="gap-2 grid grid-cols-1 sm:grid-cols-5 mt-3">
                            {([1, 2, 3, 4, 5] as Likert[]).map((n) => {
                              const selected = value === n;

                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setAnswer(q.id, n)}
                                  className={cx(
                                    "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition",
                                    "active:scale-[0.99] motion-reduce:transform-none",
                                    "focus:outline-none focus:ring-4 focus:ring-indigo-500/20",
                                    selected
                                      ? "border-indigo-500/35 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100"
                                      : "border-zinc-200/70 bg-white/70 text-zinc-700 hover:bg-white dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:text-zinc-200 dark:hover:bg-zinc-950/60",
                                  )}
                                  aria-pressed={selected}
                                >
                                  {LIKERT_LABELS[n]}
                                </button>
                              );
                            })}
                          </div>

                          {!value ? (
                            <div className="mt-2 text-zinc-500 dark:text-zinc-400 text-xs">
                              Required
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Submit */}
            <div className="flex justify-between items-center gap-3 mt-8">
              <div className="text-zinc-500 dark:text-zinc-400 text-xs">
                All questions are required.
              </div>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={onSubmit}
                className={cx(
                  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                  "focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
                  canSubmit
                    ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-[0_10px_25px_rgba(79,70,229,0.22)] hover:from-indigo-600 hover:to-indigo-400 hover:shadow-[0_12px_28px_rgba(79,70,229,0.28)] active:translate-y-[1px] active:scale-[0.99]"
                    : "cursor-not-allowed border border-zinc-300/70 bg-zinc-200/50 text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-800/40 dark:text-zinc-400",
                )}
                title={
                  canSubmit
                    ? "Submit survey"
                    : "Answer every question to submit"
                }
              >
                {submitting ? "Submitting..." : "Submit survey"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
