// app/dashboard/decks/study/[deckId]/page.tsx
import StudyClient from "./studyClient";
import { redirect } from "next/navigation";
import { forwardCookieHeader } from "@/lib/server/cookies";

type Deck = {
  deck_id: string;
  title: string;
  description?: string | null;
};

type Card = {
  card_id: string;
  deck_id: string;
  front: string;
  back: string;
};

async function getDeck(deckId: string) {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:8000";

  const cookieHeader = await forwardCookieHeader();

  const res = await fetch(`${API_URL}/decks/${deckId}`, {
    method: "GET",
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 401) {
    redirect("/logsys/login");
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to load deck (${res.status}) ${txt}`);
  }

  return (await res.json()) as { deck: Deck; cards: Card[] };
}

export default async function StudyPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const { deck } = await getDeck(deckId);
  return <StudyClient deck={deck} />;
}
