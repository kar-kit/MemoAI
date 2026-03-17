import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const QUESTION_IDS = Array.from({ length: 11 }, (_, i) => `q${i + 1}`);

export async function GET() {
  try {
    const db = await getDb();

    // Fetch users and survey responses in parallel
    const [users, responses] = await Promise.all([
      db.collection("users").find({}).toArray(),
      db.collection("survey_responses").find({}).toArray(),
    ]);

    // Map uid → survey response (one per user)
    const responseByUid = new Map(responses.map((r) => [r.uid, r]));

    const userRows = users.map((u) => {
      const response = responseByUid.get(u.uid);
      return {
        uid: u.uid,
        name: u.name as string,
        email: u.email as string,
        createdAt: u.created_at ? new Date(u.created_at).toISOString() : null,
        hasCompletedSurvey: !!response,
        surveySubmittedAt: response?.submitted_at
          ? new Date(response.submitted_at).toISOString()
          : null,
      };
    });

    // Per-question aggregate statistics
    const questionStats = QUESTION_IDS.map((qid) => {
      const values = responses
        .map((r) => r.answers?.[qid] as number | undefined)
        .filter((v): v is number => v != null);

      const avg =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;

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

    return NextResponse.json({
      totalUsers: users.length,
      completedSurvey: responseByUid.size,
      pendingSurvey: users.length - responseByUid.size,
      completionRate:
        users.length > 0
          ? Math.round((responseByUid.size / users.length) * 100)
          : 0,
      users: userRows,
      questionStats,
    });
  } catch (err) {
    console.error("[/api/stats]", err);
    return NextResponse.json(
      { error: "Failed to fetch stats from database" },
      { status: 500 }
    );
  }
}
