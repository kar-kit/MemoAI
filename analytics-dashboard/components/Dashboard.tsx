"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  uid: string;
  name: string;
  email: string;
  createdAt: string | null;
  hasCompletedSurvey: boolean;
  surveySubmittedAt: string | null;
}

export interface QuestionStat {
  id: string;
  average: number;
  responseCount: number;
  distribution: Record<number, number>;
}

export interface DashboardProps {
  totalUsers: number;
  completedSurvey: number;
  pendingSurvey: number;
  completionRate: number;
  users: UserRow[];
  questionStats: QuestionStat[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUESTIONS: Record<string, string> = {
  q1: "Manually creating the flashcard deck required a high level of effort.",
  q2: "I found the process of manually creating flashcards time-consuming.",
  q3: "I felt that a significant amount of preparation was required before I could begin studying the manually created deck.",
  q4: "Using the AI feature to generate flashcards required less effort than creating them manually.",
  q5: "The AI-assisted process reduced the time needed to prepare before studying.",
  q6: "Reviewing and refining the AI-generated flashcards required less effort than creating flashcards from scratch.",
  q7: "I was able to begin studying more quickly when using the AI-generated deck compared to the manually created deck.",
  q8: "The process of studying flashcards using the spaced-repetition system was clear and easy to follow.",
  q9: "Rating my recall confidence during review felt intuitive and required little effort.",
  q10: "Overall, the AI-assisted process made using spaced repetition feel less effortful compared to manual creation.",
  q11: "I would be more likely to use a spaced-repetition system regularly if it included AI-assisted flashcard generation.",
};

const SECTIONS = [
  {
    id: "A",
    label: "Manual Flashcard Creation",
    questions: ["q1", "q2", "q3"],
    color: "#f59e0b",
  },
  {
    id: "B",
    label: "AI-Assisted Flashcard Creation",
    questions: ["q4", "q5", "q6", "q7"],
    color: "#8b5cf6",
  },
  {
    id: "C",
    label: "Spaced-Repetition Review Experience",
    questions: ["q8", "q9"],
    color: "#06b6d4",
  },
  {
    id: "D",
    label: "Overall Perceived Effort & Adoption",
    questions: ["q10", "q11"],
    color: "#10b981",
  },
];

const LIKERT_LABELS: Record<number, string> = {
  1: "Str. Disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Str. Agree",
};

const RATING_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#10b981"];

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(end: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * end));
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick);
        }
      };
      frameRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration, delay]);

  return value;
}

// ─── Variants ─────────────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  suffix = "",
  accent,
  delay = 0,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent: string;
  delay?: number;
  icon: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const animated = useCountUp(inView ? value : 0, 1200, delay);

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-3 relative overflow-hidden"
    >
      {/* subtle background glow */}
      <div
        className="absolute inset-0 opacity-5 rounded-2xl"
        style={{
          background: `radial-gradient(circle at top right, ${accent.replace("text-", "")}, transparent 70%)`,
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          {label}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <span className={`text-4xl font-black tabular-nums ${accent}`}>
        {animated}
        {suffix}
      </span>
    </motion.div>
  );
}

// ─── Overview Charts ──────────────────────────────────────────────────────────

function OverviewCharts({
  questionStats,
  completionRate,
  completedSurvey,
  pendingSurvey,
}: {
  questionStats: QuestionStat[];
  completionRate: number;
  completedSurvey: number;
  pendingSurvey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const radarData = SECTIONS.map((s) => {
    const qs = s.questions.map((id) => questionStats.find((q) => q.id === id)!);
    const avg = qs.reduce((sum, q) => sum + (q?.average ?? 0), 0) / qs.length;
    return {
      section: `Sec. ${s.id}`,
      fullLabel: s.label,
      average: Math.round(avg * 100) / 100,
      fullMark: 5,
    };
  });

  const pieData = [
    { name: "Completed", value: completedSurvey, color: "#10b981" },
    { name: "Pending", value: pendingSurvey, color: "#374151" },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {/* Radar — section averages */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
          Section Average Scores
        </p>
        <p className="text-xs text-gray-600 mb-4">Mean Likert score per survey section (1–5)</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#1f2937" />
              <PolarAngleAxis dataKey="section" tick={{ fill: "#9ca3af", fontSize: 12, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#4b5563", fontSize: 10 }} tickCount={6} />
              <Radar
                name="Mean Score"
                dataKey="average"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.2}
                dot={{ fill: "#8b5cf6", r: 5, strokeWidth: 0 }}
                isAnimationActive
                animationBegin={300}
                animationDuration={900}
              />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [(v as number).toFixed(2), "Mean Score"]}
                labelFormatter={(label) => {
                  const s = radarData.find((r) => r.section === label);
                  return s ? s.fullLabel : label;
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3 border-t border-gray-800 pt-3">
          {SECTIONS.map((s) => {
            const avg = radarData.find((r) => r.section === `Sec. ${s.id}`)?.average ?? 0;
            return (
              <div key={s.id} className="text-center">
                <div className="text-[10px] text-gray-600 mb-0.5">Section {s.id}</div>
                <div className="text-sm font-bold" style={{ color: s.color }}>
                  {avg.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Donut — completion */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
          Survey Completion Rate
        </p>
        <p className="text-xs text-gray-600 mb-2">Participants who submitted evaluation survey</p>
        <div className="relative flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={4}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                isAnimationActive
                animationBegin={400}
                animationDuration={1000}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-emerald-400">{completionRate}%</span>
            <span className="text-xs text-gray-500 mt-0.5">completed</span>
          </div>
        </div>
        <div className="flex gap-6 justify-center mt-2 border-t border-gray-800 pt-3">
          {pieData.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-sm">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
              <span className="text-gray-400">{d.name}</span>
              <span className="font-bold text-white">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({
  stat,
  qIndex,
  sectionColor,
}: {
  stat: QuestionStat;
  qIndex: number;
  sectionColor: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const distData = [1, 2, 3, 4, 5].map((v) => ({
    rating: LIKERT_LABELS[v],
    count: stat.distribution[v] ?? 0,
    color: RATING_COLORS[v - 1],
  }));

  const pct = (stat.average / 5) * 100;
  const scoreColor =
    pct >= 72 ? "#10b981" : pct >= 52 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut", delay: qIndex * 0.08 }}
      className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4"
    >
      {/* Question label + text */}
      <div className="flex items-start gap-3">
        <span
          className="shrink-0 mt-0.5 text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{ background: sectionColor + "22", color: sectionColor }}
        >
          {stat.id.toUpperCase()}
        </span>
        <p className="text-sm text-gray-300 leading-relaxed">{QUESTIONS[stat.id]}</p>
      </div>

      {/* Average score + animated bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">Mean Score</span>
          <span className="text-lg font-black tabular-nums" style={{ color: scoreColor }}>
            {stat.average.toFixed(2)}
            <span className="text-xs font-normal text-gray-600 ml-1">/ 5.00</span>
          </span>
        </div>
        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: scoreColor }}
            initial={{ width: 0 }}
            animate={inView ? { width: `${pct}%` } : { width: 0 }}
            transition={{ duration: 0.9, ease: "easeOut", delay: qIndex * 0.08 + 0.25 }}
          />
        </div>
      </div>

      {/* Distribution horizontal bar chart */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">
          Response Distribution
        </p>
        <div className="h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={distData}
              layout="vertical"
              margin={{ top: 0, right: 36, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="rating"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={88}
              />
              <Tooltip
                cursor={{ fill: "#1f2937" }}
                contentStyle={{
                  background: "#111827",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: unknown) => [v as number, "Responses"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive animationBegin={200} animationDuration={700}>
                {distData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-[10px] text-gray-700 text-right">
        n = {stat.responseCount} response{stat.responseCount !== 1 ? "s" : ""}
      </p>
    </motion.div>
  );
}

// ─── Section Block ────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  questionStats,
}: {
  section: (typeof SECTIONS)[0];
  questionStats: QuestionStat[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const stats = section.questions
    .map((id) => questionStats.find((q) => q.id === id)!)
    .filter(Boolean);

  const sectionAvg =
    stats.reduce((sum, q) => sum + q.average, 0) / stats.length;

  return (
    <div ref={ref} className="space-y-4">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4"
      >
        <div className="w-1 h-7 rounded-full" style={{ backgroundColor: section.color }} />
        <div>
          <h2 className="text-base font-bold text-white">
            Section {section.id} — {section.label}
          </h2>
          <p className="text-xs text-gray-500">
            {section.questions.length} question{section.questions.length !== 1 ? "s" : ""} ·{" "}
            Section mean:{" "}
            <span className="font-semibold" style={{ color: section.color }}>
              {sectionAvg.toFixed(2)} / 5.00
            </span>
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <QuestionCard key={stat.id} stat={stat} qIndex={i} sectionColor={section.color} />
        ))}
      </div>
    </div>
  );
}

// ─── Users Table ──────────────────────────────────────────────────────────────

function UsersTable({ users }: { users: UserRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white">Participants</h2>
          <p className="text-xs text-gray-500">{users.length} registered user{users.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-widest">
              <th className="text-left px-5 py-3">#</th>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Registered</th>
              <th className="text-left px-5 py-3">Survey Status</th>
              <th className="text-left px-5 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => (
              <motion.tr
                key={u.uid}
                initial={{ opacity: 0, x: -10 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: idx * 0.04, duration: 0.35 }}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors last:border-b-0"
              >
                <td className="px-5 py-3 text-gray-600 font-mono text-xs">{idx + 1}</td>
                <td className="px-5 py-3 font-semibold text-white">{u.name}</td>
                <td className="px-5 py-3 text-gray-400">{u.email}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(u.createdAt)}</td>
                <td className="px-5 py-3">
                  {u.hasCompletedSurvey ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900">
                      ✓ Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-900">
                      ⏳ Pending
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(u.surveySubmittedAt)}</td>
              </motion.tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-700">
                  No participants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard(props: DashboardProps) {
  const {
    totalUsers,
    completedSurvey,
    pendingSurvey,
    completionRate,
    users,
    questionStats,
  } = props;

  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 space-y-12">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-2 h-2 rounded-full bg-violet-500"
            />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
              Live — synced from MongoDB
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            MemoAI Analytics Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            FYP Dissertation · Participant Evaluation Survey Results · {today}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-xl transition-all duration-200"
        >
          <span>⬇</span> Export / Print
        </button>
      </motion.div>

      {/* ── Stat cards ── */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard icon="👥" label="Total Participants" value={totalUsers} accent="text-white" delay={0} />
        <StatCard icon="✅" label="Survey Completed" value={completedSurvey} accent="text-emerald-400" delay={100} />
        <StatCard
          icon="⏳"
          label="Survey Pending"
          value={pendingSurvey}
          accent={pendingSurvey > 0 ? "text-amber-400" : "text-gray-400"}
          delay={200}
        />
        <StatCard icon="📊" label="Completion Rate" value={completionRate} suffix="%" accent="text-violet-400" delay={300} />
      </motion.div>

      {/* ── Overview charts ── */}
      <OverviewCharts
        questionStats={questionStats}
        completionRate={completionRate}
        completedSurvey={completedSurvey}
        pendingSurvey={pendingSurvey}
      />

      {/* ── Per-section survey results ── */}
      <div className="space-y-10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center gap-3"
        >
          <h2 className="text-lg font-bold text-white">Survey Results by Section</h2>
          <div className="flex-1 h-px bg-gray-800" />
        </motion.div>
        {SECTIONS.map((section) => (
          <SectionBlock key={section.id} section={section} questionStats={questionStats} />
        ))}
      </div>

      {/* ── Participants table ── */}
      <UsersTable users={users} />

      <p className="text-center text-xs text-gray-700 pb-6 print:hidden">
        Local admin dashboard · Refresh to pull latest data
      </p>
    </main>
  );
}
