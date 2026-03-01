from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from bson import ObjectId
from fastapi import HTTPException

from app.db.client import db


def _oid(id_str: str) -> ObjectId:
    if not ObjectId.is_valid(id_str):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")
    return ObjectId(id_str)


# -----------------------------
# STUDY SESSION HELPERS
# -----------------------------
def _get_or_create_session(uid: str, deck_id: str, limit: int) -> Dict:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be 1..100")

    now = datetime.utcnow()

    sess = db.study_sessions.find_one({"uid": uid, "deck_id": deck_id})
    if sess:
        return sess

    sess = {
        "uid": uid,
        "deck_id": deck_id,
        "session_id": str(uuid4()),
        "limit": int(limit),
        "served_card_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    db.study_sessions.insert_one(sess)
    return sess


def _finish_session(uid: str, deck_id: str) -> None:
    db.study_sessions.delete_one({"uid": uid, "deck_id": deck_id})


# -----------------------------
# SM-2 HELPERS
# -----------------------------
def _default_state(uid: str, deck_id: str, card_id: str, now: datetime) -> Dict:
    # Classic SM-2 defaults
    return {
        "uid": uid,
        "deck_id": deck_id,
        "card_id": card_id,
        "repetitions": 0,
        "interval": 0,  # days
        "ease_factor": 2.5,
        "lapses": 0,
        "last_reviewed_at": None,
        "next_due_at": now,  # new cards are due immediately
        "created_at": now,
        "updated_at": now,
    }


def _sm2_update(state: Dict, quality: int, now: datetime) -> Dict:
    """
    SM-2 quality must be 0..5. You're using 1..5.
    We'll map 1..5 -> 0..5 by subtracting 1.
    """
    q = max(0, min(5, int(quality)))

    reps = int(state.get("repetitions", 0) or 0)
    interval = int(state.get("interval", 0) or 0)
    ef = float(state.get("ease_factor", 2.5) or 2.5)
    lapses = int(state.get("lapses", 0) or 0)

    # If quality < 3: reset repetitions, schedule soon (fail)
    if q < 3:
        reps = 0
        interval = 1
        lapses += 1
        # EF still updated in SM-2 even on failure (common implementations do)
    else:
        reps += 1
        if reps == 1:
            interval = 1
        elif reps == 2:
            interval = 6
        else:
            # interval = interval * EF
            interval = int(round(max(1.0, interval * ef)))

    # EF update
    ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if ef < 1.3:
        ef = 1.3

    next_due = now + timedelta(days=interval)

    state["repetitions"] = reps
    state["interval"] = interval
    state["ease_factor"] = ef
    state["lapses"] = lapses
    state["last_reviewed_at"] = now
    state["next_due_at"] = next_due
    state["updated_at"] = now
    return state


def _get_states_map(uid: str, deck_id: str, card_ids: List[str]) -> Dict[str, Dict]:
    if not card_ids:
        return {}
    cursor = db.card_states.find(
        {"uid": uid, "deck_id": deck_id, "card_id": {"$in": card_ids}},
        {"_id": 0},
    )
    return {doc["card_id"]: doc for doc in cursor}


# -----------------------------------------
# NEXT CARD (SESSION CAPPED, SM-2 OPTION 2)
# -----------------------------------------
def get_next_card(
    uid: str, deck_id: str, limit: int = 10
) -> Tuple[Optional[Dict], int]:
    """
    Option 2:
    - Serve up to `limit` cards per session (no repeats within session)
    - Pick next card from remaining candidates by:
        1) Any due cards first (next_due_at <= now OR no state => due)
        2) If none due, pick soonest upcoming due (min next_due_at)
    """
    now = datetime.utcnow()
    deck_oid = _oid(deck_id)

    deck = db.decks.find_one({"_id": deck_oid, "uid": uid}, {"_id": 1})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    sess = _get_or_create_session(uid=uid, deck_id=deck_id, limit=limit)
    served: List[str] = list(sess.get("served_card_ids") or [])
    cap = int(sess.get("limit") or limit)

    if len(served) >= cap:
        _finish_session(uid, deck_id)
        return None, 0

    cards = list(
        db.cards.find({"uid": uid, "deck_id": deck_oid}, {"front": 1, "back": 1}).sort(
            "_id", 1
        )
    )
    if not cards:
        _finish_session(uid, deck_id)
        return None, 0

    served_set = set(served)
    candidates = [c for c in cards if str(c["_id"]) not in served_set]
    if not candidates:
        _finish_session(uid, deck_id)
        return None, 0

    candidate_ids = [str(c["_id"]) for c in candidates]
    states = _get_states_map(uid=uid, deck_id=deck_id, card_ids=candidate_ids)

    # Partition: due vs not due (missing state == due)
    due: List[Tuple[datetime, Dict]] = []
    not_due: List[Tuple[datetime, Dict]] = []

    for c in candidates:
        cid = str(c["_id"])
        st = states.get(cid)
        if not st:
            # never studied => due now (earliest)
            due.append((datetime.min, c))
            continue

        nd = st.get("next_due_at")
        # if stored as datetime, OK. If missing, treat as due.
        if not isinstance(nd, datetime):
            due.append((datetime.min, c))
            continue

        if nd <= now:
            due.append((nd, c))
        else:
            not_due.append((nd, c))

    # Pick
    if due:
        due.sort(key=lambda x: x[0])  # earliest due first; datetime.min for new cards
        picked = due[0][1]
    else:
        # fill session with soonest upcoming
        not_due.sort(key=lambda x: x[0])
        picked = not_due[0][1]

    picked_id = str(picked["_id"])

    last_review = db.card_reviews.find_one(
        {"uid": uid, "deck_id": deck_id, "card_id": picked_id},
        sort=[("rated_at", -1)],
        projection={"rating": 1},
    )
    last_rating = int(last_review["rating"]) if last_review else None

    # mark served
    served.append(picked_id)
    db.study_sessions.update_one(
        {"uid": uid, "deck_id": deck_id},
        {"$set": {"served_card_ids": served, "updated_at": now}},
    )

    remaining_after = max(0, cap - len(served))

    return (
        {
            "card_id": picked_id,
            "deck_id": deck_id,
            "front": picked.get("front", ""),
            "back": picked.get("back", ""),
            "last_rating": last_rating,  # ✅ include it
        },
        remaining_after,
    )


# -----------------------------------------
# RATE CARD (SM-2 update + history)
# -----------------------------------------
def rate_card(uid: str, deck_id: str, card_id: str, rating: int):
    deck_oid = _oid(deck_id)
    card_oid = _oid(card_id)

    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1..5")

    deck = db.decks.find_one({"_id": deck_oid, "uid": uid}, {"_id": 1})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    card = db.cards.find_one(
        {"_id": card_oid, "uid": uid, "deck_id": deck_oid}, {"_id": 1}
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    now = datetime.utcnow()

    # 1) Keep review history (unchanged behaviour)
    review_doc = {
        "uid": uid,
        "deck_id": deck_id,
        "card_id": card_id,
        "rating": int(rating),
        "rated_at": now,
    }
    db.card_reviews.insert_one(review_doc)

    # 2) Upsert SM-2 state
    state = db.card_states.find_one(
        {"uid": uid, "deck_id": deck_id, "card_id": card_id}, {"_id": 0}
    )
    if not state:
        state = _default_state(uid=uid, deck_id=deck_id, card_id=card_id, now=now)

    # Map your 1..5 rating to SM-2 quality 0..5 by subtracting 1
    quality = int(rating) - 1
    state = _sm2_update(state, quality=quality, now=now)

    db.card_states.update_one(
        {"uid": uid, "deck_id": deck_id, "card_id": card_id},
        {"$set": state},
        upsert=True,
    )

    return review_doc


# -----------------------------------------
# MASTERY SCORE (keep your current approach)
# -----------------------------------------
def get_deck_score(uid: str, deck_id: str) -> float:
    deck_oid = _oid(deck_id)

    deck = db.decks.find_one({"_id": deck_oid, "uid": uid}, {"_id": 1})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    cards = list(db.cards.find({"uid": uid, "deck_id": deck_oid}, {"_id": 1}))
    if not cards:
        return 0.0

    card_ids = [str(c["_id"]) for c in cards]

    pipeline = [
        {"$match": {"uid": uid, "deck_id": deck_id, "card_id": {"$in": card_ids}}},
        {
            "$group": {
                "_id": "$card_id",
                "total": {"$sum": 1},
                "fives": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
            }
        },
    ]

    stats = {row["_id"]: row for row in db.card_reviews.aggregate(pipeline)}

    total_ratio = 0.0
    for cid in card_ids:
        row = stats.get(cid)
        if not row:
            ratio = 0.0
        else:
            total = float(row.get("total") or 0.0)
            fives = float(row.get("fives") or 0.0)
            ratio = (fives / total) if total > 0 else 0.0
        total_ratio += ratio

    mastery = (total_ratio / len(card_ids)) * 100.0
    return float(round(max(0.0, min(100.0, mastery)), 2))


def get_deck_scores_bulk(uid: str, deck_ids: List[str]) -> Dict[str, int]:
    deck_ids = [d for d in deck_ids if ObjectId.is_valid(d)]
    if not deck_ids:
        return {}

    deck_oids = [ObjectId(d) for d in deck_ids]
    cards = list(
        db.cards.find(
            {"uid": uid, "deck_id": {"$in": deck_oids}}, {"_id": 1, "deck_id": 1}
        )
    )
    if not cards:
        return {d: 0 for d in deck_ids}

    deck_to_cards: Dict[str, List[str]] = {}
    for c in cards:
        did = str(c["deck_id"])
        deck_to_cards.setdefault(did, []).append(str(c["_id"]))

    pipeline = [
        {"$match": {"uid": uid, "deck_id": {"$in": deck_ids}}},
        {
            "$group": {
                "_id": {"deck_id": "$deck_id", "card_id": "$card_id"},
                "total": {"$sum": 1},
                "fives": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
            }
        },
    ]

    per_card_ratio: Dict[tuple, float] = {}
    for row in db.card_reviews.aggregate(pipeline):
        did = row["_id"]["deck_id"]
        cid = row["_id"]["card_id"]
        total = float(row.get("total") or 0.0)
        fives = float(row.get("fives") or 0.0)
        per_card_ratio[(did, cid)] = (fives / total) if total > 0 else 0.0

    out: Dict[str, int] = {}
    for did in deck_ids:
        card_list = deck_to_cards.get(did, [])
        if not card_list:
            out[did] = 0
            continue

        s = 0.0
        for cid in card_list:
            s += per_card_ratio.get((did, cid), 0.0)

        mastery = (s / len(card_list)) * 100.0
        out[did] = int(round(max(0.0, min(100.0, mastery))))

    return out
