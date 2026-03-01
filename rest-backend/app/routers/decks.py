# app/routers/decks.py
from __future__ import annotations

from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.db.client import db
from app.dependencies.auth import require_session
from app.schemas.cards import CardCreate, CardListResponse
from app.schemas.decks import DeckCreateRequest, DeckCreateResponse
from app.schemas.study import StudyNextResponse, RateCardRequest, RateCardResponse
from app.services.deck_service import (
    bulk_insert_cards,
    create_deck,
    get_deck_cards,
    get_deck_with_preview,
    list_decks,
)
from app.services.study_service import get_next_card, rate_card, get_deck_scores_bulk
from pydantic import BaseModel

router = APIRouter(prefix="/decks", tags=["decks"])


class CardUpdate(BaseModel):
    front: str
    back: str


def _oid(id_str: str) -> ObjectId:
    if not ObjectId.is_valid(id_str):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")
    return ObjectId(id_str)


@router.post("", response_model=DeckCreateResponse)
def create_deck_route(payload: DeckCreateRequest, uid: str = Depends(require_session)):
    try:
        title = (payload.title or "Untitled deck").strip()
        result = create_deck(
            uid=uid,
            title=title,
            source_type=payload.source_type,
            source_ref=payload.source_ref,
            tags=payload.tags,
        )
        return {
            "deck_id": result.deck_id,
            "title": result.title,
            "source_type": result.source_type,
            "source_ref": result.source_ref,
            "tags": result.tags,
            "created_at": result.created_at,
            "updated_at": result.updated_at,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
def list_decks_route(
    limit: int = Query(default=50, ge=1, le=200),
    uid: str = Depends(require_session),
):
    try:
        decks = list_decks(uid=uid, limit=limit)  # List[dict]

        deck_ids = [d.get("deck_id") for d in decks if d.get("deck_id")]
        scores = get_deck_scores_bulk(uid=uid, deck_ids=deck_ids)  # type: ignore # {deck_id: 0..100}

        for d in decks:
            did = d.get("deck_id")
            d["mastery_score"] = int(scores.get(did, 0)) if did else 0

        return decks
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{deck_id}")
def get_deck_route(
    deck_id: str,
    request: Request,
    debug_cookies: int = Query(default=0, ge=0, le=1),
    uid: str = Depends(require_session),
):
    if debug_cookies == 1:
        print("🍪 Incoming cookies:", request.cookies)

    deck_oid = _oid(deck_id)

    deck = db.decks.find_one({"_id": deck_oid, "uid": uid}, {"uid": 0})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    cards = list(
        db.cards.find({"deck_id": deck_oid, "uid": uid}, {"uid": 0}).sort(
            "created_at", 1
        )
    )

    deck_out = {
        "deck_id": str(deck["_id"]),
        "title": deck.get("title", ""),
        "description": deck.get("description"),
        "source_type": deck.get("source_type", "unknown"),
        "source_ref": deck.get("source_ref"),
        "tags": deck.get("tags", []) or [],
        "created_at": deck.get("created_at"),
        "updated_at": deck.get("updated_at"),
    }

    cards_out = [
        {
            "card_id": str(c["_id"]),
            "deck_id": str(c["deck_id"]),
            "front": c.get("front", ""),
            "back": c.get("back", ""),
        }
        for c in cards
    ]

    return {"deck": deck_out, "cards": cards_out}


@router.get("/{deck_id}/preview")
def get_deck_preview_route(
    deck_id: str,
    preview_count: int = Query(default=3, ge=1, le=10),
    uid: str = Depends(require_session),
):
    try:
        return get_deck_with_preview(
            uid=uid, deck_id=deck_id, preview_count=preview_count
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{deck_id}/cards")
def add_cards_route(
    deck_id: str, cards: List[CardCreate], uid: str = Depends(require_session)
):
    try:
        inserted = bulk_insert_cards(
            uid=uid, deck_id=deck_id, cards=[c.model_dump() for c in cards]
        )
        preview = get_deck_with_preview(uid=uid, deck_id=deck_id, preview_count=3)
        return {"inserted": inserted, "deck": preview}
    except ValueError as ve:
        msg = str(ve)
        status = 404 if "not found" in msg.lower() else 400
        raise HTTPException(status_code=status, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{deck_id}/cards", response_model=CardListResponse)
def list_cards_route(
    deck_id: str,
    limit: int = Query(default=200, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    uid: str = Depends(require_session),
):
    try:
        cards = get_deck_cards(uid=uid, deck_id=deck_id, limit=limit, skip=skip)
        return {"deck_id": deck_id, "cards": cards}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{deck_id}/cards/{card_id}")
def update_card(
    deck_id: str, card_id: str, payload: CardUpdate, uid: str = Depends(require_session)
):
    deck_oid = _oid(deck_id)
    card_oid = _oid(card_id)

    deck = db.decks.find_one({"_id": deck_oid, "uid": uid}, {"_id": 1})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    res = db.cards.update_one(
        {"_id": card_oid, "deck_id": deck_oid},
        {"$set": {"front": payload.front, "back": payload.back}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")

    return {"ok": True}


@router.delete("/{deck_id}/cards/{card_id}")
def delete_card(deck_id: str, card_id: str, uid: str = Depends(require_session)):
    deck_oid = _oid(deck_id)
    card_oid = _oid(card_id)

    deck = db.decks.find_one({"_id": deck_oid, "uid": uid}, {"_id": 1})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    res = db.cards.delete_one({"_id": card_oid, "deck_id": deck_oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")

    return {"ok": True}
