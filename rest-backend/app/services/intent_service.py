# app/services/intent_service.py
from __future__ import annotations

from typing import List, Dict, Optional
import json
import re

from app.schemas.llm_dispatch import IntentResult
from app.services.llm_service import chat

KEYWORDS = (
    "flashcard",
    "flashcards",
    "deck",
    "make a deck",
    "create a deck",
    "generate flashcards",
    "turn this into flashcards",
    "make flashcards",
)

# Keep in sync with deck_generation_service.py MAX_CARDS_TOTAL if you want
MIN_CARDS = 1
MAX_CARDS = 60


def _heuristic_is_deck_request(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in KEYWORDS)


def _extract_card_count(text: str) -> Optional[int]:
    """
    Pull '30' out of messages like:
    - "make 30 flashcards"
    - "generate 15 cards"
    - "turn this into 50 questions"
    """
    t = (text or "").lower()

    patterns = [
        r"\b(\d{1,3})\s*(?:flashcards?|cards?|questions?|q\/a|qa)\b",
        r"\b(?:make|create|generate|give)\s*(?:me\s*)?(\d{1,3})\b",
        r"\b(\d{1,3})\s*(?:of\s*)?(?:them|these)\b",
    ]

    for p in patterns:
        m = re.search(p, t)
        if m:
            try:
                n = int(m.group(1))
                n = max(MIN_CARDS, min(n, MAX_CARDS))
                return n
            except Exception:
                pass

    return None


def detect_intent(messages: List[Dict[str, str]], file_present: bool) -> IntentResult:
    latest_user = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            latest_user = m.get("content", "")
            break

    explicit_count = _extract_card_count(latest_user)

    # Quick shortcut if file is present + user obviously wants flashcards
    if _heuristic_is_deck_request(latest_user) and file_present:
        args = {}
        if explicit_count is not None:
            args["card_count"] = explicit_count
        return IntentResult(intent="generate_deck", confidence=0.95, args=args)

    prompt = (
        "You are an intent classifier for a study app.\n"
        "Decide if the user wants normal chat OR to generate a flashcard deck.\n"
        "Return ONLY valid JSON. No markdown. No extra text.\n\n"
        "Valid intents: chat, generate_deck\n\n"
        f"File attached: {str(file_present).lower()}\n\n"
        "Rules:\n"
        "- If the user asks to make/create/generate flashcards or a deck (especially from an attached file), choose generate_deck.\n"
        "- If the user is asking questions or chatting, choose chat.\n"
        "- If unsure, choose chat with lower confidence.\n\n"
        "Return JSON schema:\n"
        '{ "intent": "chat|generate_deck", "confidence": 0.0, "args": { "title": "optional", "card_count": 24 } }\n\n'
        "Conversation (most recent last):\n"
        + "\n".join([f'{m["role"].upper()}: {m["content"]}' for m in messages[-8:]])
    )

    raw = chat([{"role": "user", "content": prompt}]).strip()

    try:
        data = json.loads(raw)

        # Ensure args exists
        args = data.get("args") or {}
        if not isinstance(args, dict):
            args = {}

        # If user explicitly wrote a number, trust that over LLM parsing
        if explicit_count is not None:
            args["card_count"] = explicit_count

        # Clamp LLM-provided card_count too
        if "card_count" in args:
            try:
                n = int(args["card_count"])
                args["card_count"] = max(MIN_CARDS, min(n, MAX_CARDS))
            except Exception:
                args.pop("card_count", None)

        data["args"] = args

        return IntentResult(**data)
    except Exception:
        # If heuristics match without file, still allow it
        if _heuristic_is_deck_request(latest_user):
            args = {}
            if explicit_count is not None:
                args["card_count"] = explicit_count
            return IntentResult(intent="generate_deck", confidence=0.7, args=args)

        return IntentResult(intent="chat", confidence=0.0, args={})
