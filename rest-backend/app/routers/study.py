from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from app.dependencies.auth import require_session
from app.schemas.study import StudyNextResponse, RateCardRequest, RateCardResponse
from app.services.study_service import get_next_card, rate_card, get_deck_score

router = APIRouter(prefix="/decks", tags=["study"])


@router.get("/{deck_id}/study/next", response_model=StudyNextResponse)
def study_next(
    deck_id: str,
    limit: int = Query(default=10, ge=1, le=100),
    uid: str = Depends(require_session),
):
    card, remaining = get_next_card(uid=uid, deck_id=deck_id, limit=limit)
    return {"deck_id": deck_id, "card": card, "remaining": remaining}


@router.post("/{deck_id}/study/{card_id}/rate", response_model=RateCardResponse)
def study_rate(
    deck_id: str,
    card_id: str,
    payload: RateCardRequest,
    uid: str = Depends(require_session),
):
    doc = rate_card(
        uid=uid, deck_id=deck_id, card_id=card_id, rating=int(payload.rating)
    )
    return {
        "deck_id": deck_id,
        "card_id": card_id,
        "rating": doc["rating"],
        "rated_at": doc["rated_at"],
    }


@router.get("/{deck_id}/study/score")
def study_score(deck_id: str, uid: str = Depends(require_session)):
    score = get_deck_score(uid=uid, deck_id=deck_id)
    return {"deck_id": deck_id, "score": score}
