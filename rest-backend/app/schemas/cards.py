# app/schemas/cards.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from .object_id import PyObjectId


class CardCreate(BaseModel):
    front: str = Field(min_length=1, max_length=300)
    back: str = Field(min_length=1, max_length=1200)
    tags: List[str] = Field(default_factory=list, max_items=20)  # type: ignore
    difficulty: Optional[int] = Field(default=None, ge=1, le=5)


class CardCreateRequest(BaseModel):
    deck_id: str
    cards: List[CardCreate] = Field(min_length=1, max_length=200)


class CardDocument(BaseModel):
    id: PyObjectId = Field(alias="_id")
    uid: str
    deck_id: PyObjectId
    front: str
    back: str
    tags: List[str] = Field(default_factory=list)
    difficulty: Optional[int] = None
    created_at: datetime

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {PyObjectId: str},
    }


class CardResponse(BaseModel):
    card_id: str
    deck_id: str
    front: str
    back: str
    tags: List[str] = Field(default_factory=list)
    difficulty: Optional[int] = None
    created_at: datetime


class CardListResponse(BaseModel):
    deck_id: str
    cards: List[CardResponse]
