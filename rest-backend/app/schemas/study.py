# /schemas/study.py
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Literal


Rating = Literal[1, 2, 3, 4, 5]


class StudyCard(BaseModel):
    card_id: str
    deck_id: str
    front: str
    back: str
    last_rating: Optional[int] = None  # ✅ add this


class StudyNextResponse(BaseModel):
    deck_id: str
    card: Optional[StudyCard] = None  # None when finished
    remaining: int = 0


class RateCardRequest(BaseModel):
    rating: Rating = Field(..., description="1=hardest, 5=easiest/know well")


class RateCardResponse(BaseModel):
    deck_id: str
    card_id: str
    rating: int
    rated_at: datetime
