# app/services/deck_service.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Dict, Any

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING

from app.db.client import db

from bson import ObjectId
from app.db.client import db


# ---------- Helpers ----------


def _oid(id_str: str) -> ObjectId:
    if not ObjectId.is_valid(id_str):
        raise ValueError("Invalid ObjectId")
    return ObjectId(id_str)


def _now() -> datetime:
    return datetime.utcnow()


# ---------- Public API ----------


@dataclass
class DeckCreateResult:
    deck_id: str
    title: str
    source_type: str
    source_ref: Optional[str]
    tags: List[str]
    created_at: datetime
    updated_at: datetime


def ensure_deck_indexes() -> None:
    """
    Call once on startup if you want (optional).
    Keeps lookups snappy.
    """
    db.decks.create_index([("uid", ASCENDING), ("updated_at", DESCENDING)])
    db.cards.create_index(
        [("uid", ASCENDING), ("deck_id", ASCENDING), ("created_at", ASCENDING)]
    )


def create_deck(
    *,
    uid: str,
    title: str,
    source_type: str = "unknown",
    source_ref: Optional[str] = None,
    tags: Optional[List[str]] = None,
    description: Optional[str] = None,
) -> DeckCreateResult:
    now = _now()
    doc = {
        "uid": uid,
        "title": title.strip()[:80],
        "description": description,
        "source_type": source_type,
        "source_ref": source_ref,
        "tags": tags or [],
        "created_at": now,
        "updated_at": now,
    }
    res = db.decks.insert_one(doc)
    return DeckCreateResult(
        deck_id=str(res.inserted_id),
        title=doc["title"],
        source_type=doc["source_type"],
        source_ref=doc["source_ref"],
        tags=doc["tags"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def touch_deck_updated_at(*, uid: str, deck_id: str) -> None:
    db.decks.update_one(
        {"_id": _oid(deck_id), "uid": uid},
        {"$set": {"updated_at": _now()}},
    )


def bulk_insert_cards(
    *,
    uid: str,
    deck_id: str,
    cards: List[Dict[str, Any]],
) -> int:
    """
    cards items expected:
      { front: str, back: str, tags?: list[str], difficulty?: int }
    """
    deck_oid = _oid(deck_id)

    # ownership check (avoid inserting into someone else's deck)
    deck = db.decks.find_one({"_id": deck_oid, "uid": uid}, {"_id": 1})
    if not deck:
        raise ValueError("Deck not found")

    now = _now()
    docs = []
    for c in cards:
        front = (c.get("front") or "").strip()
        back = (c.get("back") or "").strip()
        if not front or not back:
            continue

        docs.append(
            {
                "uid": uid,
                "deck_id": deck_oid,
                "front": front[:300],
                "back": back[:1200],
                "tags": c.get("tags", []) or [],
                "difficulty": c.get("difficulty", None),
                "created_at": now,
            }
        )

    if not docs:
        return 0

    res = db.cards.insert_many(docs)
    touch_deck_updated_at(uid=uid, deck_id=deck_id)
    return len(res.inserted_ids)


def list_decks(uid: str, limit: int = 50):
    decks = list(
        db.decks.find({"uid": uid}, {"uid": 0}).sort("updated_at", -1).limit(limit)
    )

    deck_ids = [d["_id"] for d in decks]

    counts = db.cards.aggregate(
        [
            {"$match": {"uid": uid, "deck_id": {"$in": deck_ids}}},
            {"$group": {"_id": "$deck_id", "count": {"$sum": 1}}},
        ]
    )

    count_map = {str(c["_id"]): c["count"] for c in counts}

    out = []
    for d in decks:
        did = str(d["_id"])
        out.append(
            {
                "deck_id": did,
                "title": d.get("title", "Untitled deck"),
                "description": d.get("description"),
                "source_type": d.get("source_type", "unknown"),
                "updated_at": d.get("updated_at"),
                "created_at": d.get("created_at"),
                "card_count": count_map.get(did, 0),
            }
        )
    return out


def get_deck(*, uid: str, deck_id: str) -> Dict[str, Any]:
    deck = db.decks.find_one({"_id": _oid(deck_id), "uid": uid})
    if not deck:
        raise ValueError("Deck not found")

    deck["deck_id"] = str(deck["_id"])
    deck.pop("_id", None)
    return deck


def get_deck_cards(
    *,
    uid: str,
    deck_id: str,
    limit: int = 200,
    skip: int = 0,
) -> List[Dict[str, Any]]:
    deck_oid = _oid(deck_id)

    # ownership check
    deck = db.decks.find_one({"_id": deck_oid, "uid": uid}, {"_id": 1})
    if not deck:
        raise ValueError("Deck not found")

    cards = list(
        db.cards.find(
            {"uid": uid, "deck_id": deck_oid},
            {"front": 1, "back": 1, "tags": 1, "difficulty": 1, "created_at": 1},
        )
        .sort("created_at", 1)
        .skip(skip)
        .limit(limit)
    )

    out = []
    for c in cards:
        out.append(
            {
                "card_id": str(c["_id"]),
                "deck_id": deck_id,
                "front": c.get("front", ""),
                "back": c.get("back", ""),
                "tags": c.get("tags", []) or [],
                "difficulty": c.get("difficulty", None),
                "created_at": c.get("created_at"),
            }
        )
    return out


def get_deck_with_preview(
    *,
    uid: str,
    deck_id: str,
    preview_count: int = 3,
) -> Dict[str, Any]:
    deck = get_deck(uid=uid, deck_id=deck_id)
    preview_cards = get_deck_cards(uid=uid, deck_id=deck_id, limit=preview_count)
    card_count = db.cards.count_documents({"uid": uid, "deck_id": _oid(deck_id)})

    return {
        **deck,
        "card_count": int(card_count),
        "preview_cards": preview_cards,
    }
