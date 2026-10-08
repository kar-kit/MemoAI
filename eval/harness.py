"""Runs MemoAI's real deck-generation path (rest-backend/app/services/deck_generation_service.py)
with instrumentation around the LLM call and in-memory stand-ins for MongoDB.

What is real: chunking, the exact prompts, JSON extraction, exact-match dedupe, top-up,
truncation, title generation and Pydantic validation, all imported from the backend.
What is stubbed: create_deck / bulk_insert_cards / get_deck_with_preview (Mongo writes),
and the `chat` function, which is replaced by a wrapper that makes the same Ollama call
(same messages, no extra options, as llm_service.chat does) against a forced model and records timings.
"""
from __future__ import annotations

import os
import sys
import time
import uuid
from pathlib import Path
from typing import Callable, Dict, List, Optional

REPO = Path(__file__).resolve().parents[1]
BACKEND = REPO / "rest-backend"

# app.db.client raises at import if MONGODB_URI is unset. MongoClient connects lazily,
# so a dummy URI is never contacted; all Mongo writes are stubbed below.
os.environ.setdefault("MONGODB_URI", "mongodb://127.0.0.1:1/eval-stub")
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services import deck_generation_service as dgs  # noqa: E402

from metrics import json_parse_status, lexical_support, near_duplicate_pairs  # noqa: E402

ChatFn = Callable[[List[Dict], str], Dict]
"""(messages, model) -> {"content", "prompt_eval_count", "eval_count", "eval_duration_ns",
"load_duration_ns", "thinking_chars"}"""


def ollama_chat_fn(host: str, timeout_s: float = 600) -> ChatFn:
    from ollama import Client

    client = Client(host=host, timeout=timeout_s)

    def _call(messages, model):
        # Mirrors llm_service.chat: client.chat(model=..., messages=...) with no options.
        resp = client.chat(model=model, messages=messages)
        msg = resp.get("message") or {}
        thinking = getattr(msg, "thinking", None) if not isinstance(msg, dict) else msg.get("thinking")
        return {
            "content": msg["content"] if isinstance(msg, dict) else msg.content,
            "prompt_eval_count": resp.get("prompt_eval_count"),
            "eval_count": resp.get("eval_count"),
            "eval_duration_ns": resp.get("eval_duration"),
            "load_duration_ns": resp.get("load_duration"),
            "thinking_chars": len(thinking or ""),
        }

    return _call


class _Recorder:
    def __init__(self, chat_fn: ChatFn, model: str):
        self.chat_fn, self.model = chat_fn, model
        self.calls: List[Dict] = []
        self.parsed_cards: List[Dict] = []

    def chat(self, messages, *, model: Optional[str] = None) -> str:
        prompt = messages[-1]["content"]
        kind = "cards" if prompt.startswith("You generate flashcards") else "title"
        t0 = time.perf_counter()
        r = self.chat_fn(messages, self.model)
        latency = time.perf_counter() - t0
        raw = r.get("content") or ""
        rec = {
            "kind": kind,
            "latency_s": round(latency, 3),
            "prompt_eval_count": r.get("prompt_eval_count"),
            "eval_count": r.get("eval_count"),
            "eval_duration_ns": r.get("eval_duration_ns"),
            "load_duration_ns": r.get("load_duration_ns"),
            "thinking_chars": r.get("thinking_chars", 0),
            "raw_chars": len(raw),
            "raw_preview": raw[:400],
        }
        if kind == "cards":
            rec["parse_status"] = json_parse_status(raw, dgs._extract_json_object)
            if rec["parse_status"] == "failed":
                rec["raw_full"] = raw  # keep the whole reply for error analysis
            data = dgs._extract_json_object(raw) or {}
            cards = data.get("cards") if isinstance(data, dict) else None
            n = 0
            if isinstance(cards, list):
                for c in cards:
                    if isinstance(c, dict) and (c.get("front") or "").strip() and (c.get("back") or "").strip():
                        self.parsed_cards.append({"front": c["front"].strip()[:300], "back": c["back"].strip()[:1200]})
                        n += 1
            rec["cards_parsed"] = n
        self.calls.append(rec)
        return raw


def run_deck(*, source_text: str, requested: int, model: str, chat_fn: ChatFn) -> Dict:
    """One end-to-end call of generate_deck_from_text_chunked for one model."""
    rec = _Recorder(chat_fn, model)
    store: Dict[str, Dict] = {}

    class _Deck:
        def __init__(self, title):
            self.deck_id = uuid.uuid4().hex
            store[self.deck_id] = {"title": title, "cards": []}

    def create_deck(*, uid, title, source_type, source_ref, tags):
        return _Deck(title)

    def bulk_insert_cards(*, uid, deck_id, cards):
        store[deck_id]["cards"].extend(cards)
        return len(cards)

    def get_deck_with_preview(*, uid, deck_id, preview_count):
        d = store[deck_id]
        return {"title": d["title"], "card_count": len(d["cards"]), "preview_cards": d["cards"][:preview_count]}

    patches = {
        "chat": rec.chat,
        "create_deck": create_deck,
        "bulk_insert_cards": bulk_insert_cards,
        "get_deck_with_preview": get_deck_with_preview,
    }
    saved = {k: getattr(dgs, k) for k in patches}
    for k, v in patches.items():
        setattr(dgs, k, v)
    t0 = time.perf_counter()
    error = None
    result: Dict = {}
    try:
        result = dgs.generate_deck_from_text_chunked(
            uid="eval",
            source_text=source_text,
            source_type="file",
            source_ref="eval",
            requested_title=None,
            requested_card_count=requested,
        )
    except Exception as e:  # recorded, not raised: a crash is a result
        error = f"{type(e).__name__}: {e}"
    finally:
        for k, v in saved.items():
            setattr(dgs, k, v)
    deck_latency = time.perf_counter() - t0

    cards = store[result["deck_id"]]["cards"] if result.get("deck_id") in store else []
    deduped = dgs._dedupe_cards(list(rec.parsed_cards))
    return {
        "model": model,
        "requested": requested,
        "target_after_clamp": dgs._clamp_card_count(requested),
        "deck_latency_s": round(deck_latency, 3),
        "error": error,
        "title": result.get("title"),
        "cards": cards,
        "cards_final": len(cards),
        "cards_parsed_total": len(rec.parsed_cards),
        "exact_dupes_removed": len(rec.parsed_cards) - len(deduped),
        "near_dup_pairs": near_duplicate_pairs([c["front"] for c in cards]),
        "lexical_support": [lexical_support(c["back"], source_text) for c in cards],
        "calls": rec.calls,
    }
