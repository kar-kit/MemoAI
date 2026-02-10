// /app/dashboard/decks/[deckId]/page.tsx
import DeckEditor from "./deckEditor";
import { cookies } from "next/headers";

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

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${API_URL}/decks/${deckId}`, {
    method: "GET",
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load deck (${res.status})`);
  }

  return (await res.json()) as { deck: Deck; cards: Card[] };
}

export default async function DeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const { deck, cards } = await getDeck(deckId);

  return <DeckEditor deckId={deckId} initialDeck={deck} initialCards={cards} />;
}
