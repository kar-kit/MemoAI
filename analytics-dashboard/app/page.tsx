import { getDb } from "@/lib/mongodb";
import Dashboard, { type DashboardProps } from "@/components/Dashboard";

const QUESTION_IDS = Array.from({ length: 11 }, (_, i) => `q${i + 1}`);

async function getDashboardData(): Promise<DashboardProps> {
  const db = await getDb();

  const [users, responses] = await Promise.all([
    db.collection("users").find({}).sort({ created_at: -1 }).toArray(),
    db.collection("survey_responses").find({}).toArray(),
  ]);

  const responseByUid = new Map(responses.map((r) => [r.uid as string, r]));

  const userRows = users.map((u) => {
    const response = responseByUid.get(u.uid as string);
    return {
      uid: u.uid as string,
      name: u.name as string,
      email: u.email as string,
      createdAt: u.created_at ? new Date(u.created_at as Date).toISOString() : null,
      hasCompletedSurvey: !!response,
      surveySubmittedAt: response?.submitted_at
        ? new Date(response.submitted_at as Date).toISOString()
        : null,
    };
  });

  const questionStats = QUESTION_IDS.map((qid) => {
    const values = responses
      .map((r) => r.answers?.[qid] as number | undefined)
      .filter((v): v is number => v != null);

    const avg =
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    values.forEach((v) => {
      if (v >= 1 && v <= 5) distribution[v]++;
    });

    return {
      id: qid,
      average: Math.round(avg * 100) / 100,
      responseCount: values.length,
      distribution,
    };
  });

  return {
    totalUsers: users.length,
    completedSurvey: responseByUid.size,
    pendingSurvey: users.length - responseByUid.size,
    completionRate:
      users.length > 0 ? Math.round((responseByUid.size / users.length) * 100) : 0,
    users: userRows,
    questionStats,
  };
}

export default async function DashboardPage() {
  let data: DashboardProps;

  try {
    data = await getDashboardData();
  } catch (err) {
    console.error("[dashboard] DB error:", err);
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-950 border border-red-800 rounded-2xl p-10 max-w-lg text-center space-y-3">
          <p className="text-red-400 font-bold text-lg">Could not connect to MongoDB</p>
          <p className="text-gray-400 text-sm">
            Make sure <code className="text-red-300 bg-red-950/50 px-1 rounded">.env.local</code>{" "}
            contains a valid <code className="text-red-300 bg-red-950/50 px-1 rounded">MONGODB_URI</code>{" "}
            and the cluster is reachable.
          </p>
          <p className="text-gray-600 text-xs font-mono">{String(err)}</p>
        </div>
      </main>
    );
  }

  return <Dashboard {...data} />;
}
