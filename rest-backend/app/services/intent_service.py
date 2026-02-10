# app/services/intent_service.py
from __future__ import annotations

from typing import List, Dict

import json

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


def _heuristic_is_deck_request(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in KEYWORDS)


def detect_intent(messages: List[Dict[str, str]], file_present: bool) -> IntentResult:
    latest_user = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            latest_user = m.get("content", "")
            break

    # Quick shortcut if file is present + user obviously wants flashcards
    if _heuristic_is_deck_request(latest_user) and file_present:
        return IntentResult(intent="generate_deck", confidence=0.95, args={})

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
        return IntentResult(**data)
    except Exception:
        return IntentResult(intent="chat", confidence=0.0, args={})
