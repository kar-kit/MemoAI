# app/services/deck_generation_service.py
from __future__ import annotations

from typing import Optional, List, Dict, Any
import json
import re
import logging

from app.services.llm_service import chat
from app.services.deck_service import (
    create_deck,
    bulk_insert_cards,
    get_deck_with_preview,
)
from app.schemas.deck_llm import LLMDeck, LLMCard

logger = logging.getLogger(__name__)

# ---------- Tuning knobs ----------
MAX_SOURCE_CHARS = 120_000  # guardrail for huge files (we chunk anyway)
CHUNK_CHARS = 8_000  # size per chunk prompt
CHUNK_OVERLAP = 800  # overlap helps continuity
MAX_CARDS_TOTAL = 60
MIN_CARDS_TOTAL = 8


# ---------- Helpers ----------
def _clip(text: str, max_chars: int) -> str:
    text = (text or "").strip()
    return text[:max_chars]


def _clean_text(text: str) -> str:
    """
    Makes extracted PPT/PDF text less noisy.
    """
    t = (text or "").replace("\r", "\n")
    # collapse excessive blank lines
    t = re.sub(r"\n{3,}", "\n\n", t)
    # remove repeated whitespace
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()


def _chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    """
    Simple character chunking with overlap.
    Stable and fast.
    """
    chunks: List[str] = []
    i = 0
    n = len(text)
    while i < n:
        end = min(i + chunk_size, n)
        chunk = text[i:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == n:
            break
        i = max(0, end - overlap)
    return chunks


def _normalize(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def _dedupe_cards(cards: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Dedupe by normalized front, then by front+back.
    """
    seen_front = set()
    seen_pair = set()
    out: List[Dict[str, str]] = []

    for c in cards:
        f = _normalize(c.get("front", ""))
        b = _normalize(c.get("back", ""))
        if not f or not b:
            continue

        pair = f"{f}||{b}"
        if f in seen_front or pair in seen_pair:
            continue

        seen_front.add(f)
        seen_pair.add(pair)
        out.append(c)

    return out


def _safe_json_load(raw: str) -> Optional[dict]:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _extract_json_object(raw: str) -> Optional[dict]:
    """
    LLMs often wrap JSON with extra text.
    This extracts the first plausible JSON object and parses it.
    """
    raw = (raw or "").strip()
    if not raw:
        return None

    # 1) Try direct
    direct = _safe_json_load(raw)
    if direct is not None:
        return direct

    # 2) Try to find a JSON object within the text
    #    Greedy match across lines, then attempt parse.
    m = re.search(r"\{.*\}", raw, flags=re.S)
    if not m:
        return None

    candidate = m.group(0).strip()
    return _safe_json_load(candidate)


def _llm_cards_from_chunk(chunk: str, target_cards: int) -> List[Dict[str, str]]:
    """
    Ask the LLM for cards from a single chunk.
    Must return strict JSON (but we also robustly extract JSON if it wraps it).
    """
    prompt = (
        "You generate flashcards from study material.\n"
        "Use ONLY the material below.\n"
        "Write atomic Q/A cards.\n"
        "Avoid duplicates.\n"
        "No markdown.\n"
        "Return STRICT JSON ONLY.\n\n"
        "JSON schema:\n"
        '{ "cards": [ { "front": "string", "back": "string" } ] }\n\n'
        f"Target cards from this chunk: {target_cards}\n\n"
        "--- MATERIAL CHUNK START ---\n"
        f"{chunk}\n"
        "--- MATERIAL CHUNK END ---\n"
    )

    raw = chat([{"role": "user", "content": prompt}]) or ""
    logger.info("[deckgen] llm_raw_preview=%s", raw[:600].replace("\n", "\\n"))

    data = _extract_json_object(raw)
    if not data:
        logger.warning("[deckgen] failed_to_parse_json_from_llm_output")
        return []

    cards = data.get("cards") or []
    cleaned: List[Dict[str, str]] = []

    if not isinstance(cards, list):
        logger.warning("[deckgen] parsed_json_cards_not_list type=%s", type(cards))
        return []

    for c in cards:
        if not isinstance(c, dict):
            continue
        front = (c.get("front") or "").strip()
        back = (c.get("back") or "").strip()
        if not front or not back:
            continue
        cleaned.append({"front": front[:300], "back": back[:1200]})

    logger.info("[deckgen] parsed_cards_from_chunk=%d", len(cleaned))
    return cleaned


def _llm_title_from_text(text: str) -> str:
    prompt = (
        "Give a short deck title (max 4 words). No quotes. No punctuation.\n"
        "Base it on the study material which should summarise this decks contents.\n\n"
        "MATERIAL:\n"
        f"{_clip(text, 6000)}\n"
    )
    title = chat([{"role": "user", "content": prompt}]).strip()
    title = title.replace("\n", " ").replace('"', "").strip()
    # strip common punctuation
    title = re.sub(r"[^\w\s-]", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    return title[:80] or "Untitled deck"


def _clamp_card_count(n: int) -> int:
    if n < MIN_CARDS_TOTAL:
        return MIN_CARDS_TOTAL
    if n > MAX_CARDS_TOTAL:
        return MAX_CARDS_TOTAL
    return n


# ---------- Public function ----------
def generate_deck_from_text_chunked(
    *,
    uid: str,
    source_text: str,
    source_type: str,
    source_ref: Optional[str],
    requested_title: Optional[str] = None,
    requested_card_count: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Chunked, deduped, schema-validated deck generation.
    Returns { deck_id, title, card_count, preview_cards }
    """
    cleaned_text = _clean_text(_clip(source_text, MAX_SOURCE_CHARS))
    if not cleaned_text:
        title = (requested_title or "Untitled deck").strip()[:80]
        deck = create_deck(
            uid=uid,
            title=title,
            source_type=source_type,
            source_ref=source_ref,
            tags=[],
        )
        preview = get_deck_with_preview(uid=uid, deck_id=deck.deck_id, preview_count=3)
        return {
            "deck_id": deck.deck_id,
            "title": preview.get("title", title),
            "card_count": int(preview.get("card_count", 0)),
            "preview_cards": preview.get("preview_cards", []),
        }

    target_total = _clamp_card_count(int(requested_card_count or 24))
    chunks = _chunk_text(cleaned_text, CHUNK_CHARS, CHUNK_OVERLAP)[:10]
    per_chunk = max(3, target_total // max(1, len(chunks)))

    logger.info(
        "[deckgen] start uid=%s source_type=%s target_total=%d chunks=%d per_chunk=%d extracted_len=%d",
        uid,
        source_type,
        target_total,
        len(chunks),
        per_chunk,
        len(cleaned_text),
    )

    all_cards: List[Dict[str, str]] = []

    for idx, chunk in enumerate(chunks):
        cards = _llm_cards_from_chunk(chunk, target_cards=per_chunk)
        all_cards.extend(cards)

        logger.info(
            "[deckgen] after_chunk idx=%d total_cards_raw=%d",
            idx,
            len(all_cards),
        )

        if len(all_cards) >= int(target_total * 1.3):
            break

    all_cards = _dedupe_cards(all_cards)

    # top-up if short
    if len(all_cards) < target_total and chunks:
        need = min(12, target_total - len(all_cards))
        top_up = _llm_cards_from_chunk(chunks[0], target_cards=max(3, need))
        all_cards = _dedupe_cards(all_cards + top_up)

    all_cards = all_cards[:target_total]
    logger.info("[deckgen] deduped_final_cards=%d", len(all_cards))

    # Title
    title = (requested_title or "").strip()
    if not title:
        title = _llm_title_from_text(cleaned_text)
    title = title[:80]

    # Validate with Pydantic, but salvage valid cards instead of nuking all
    valid_cards: List[LLMCard] = []
    for c in all_cards:
        try:
            valid_cards.append(LLMCard(**c))
        except Exception:
            continue

    deck_obj = LLMDeck(title=title, cards=valid_cards)
    logger.info("[deckgen] validated_cards=%d", len(deck_obj.cards))

    # Save deck
    deck = create_deck(
        uid=uid,
        title=deck_obj.title,
        source_type=source_type,
        source_ref=source_ref,
        tags=[],
    )

    # Save cards
    inserted = bulk_insert_cards(
        uid=uid,
        deck_id=deck.deck_id,
        cards=[c.model_dump() for c in deck_obj.cards],
    )
    logger.info(
        "[deckgen] inserted_cards=%d deck_id=%s", int(inserted or 0), deck.deck_id
    )

    # Return preview
    preview = get_deck_with_preview(uid=uid, deck_id=deck.deck_id, preview_count=3)

    # Prefer preview count if your query returns it; otherwise fall back to inserted
    preview_count = preview.get("card_count", None)
    final_count = (
        int(preview_count) if preview_count is not None else int(inserted or 0)
    )

    return {
        "deck_id": deck.deck_id,
        "title": preview.get("title", deck_obj.title),
        "card_count": final_count,
        "preview_cards": preview.get("preview_cards", []),
    }
