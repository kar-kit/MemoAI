# app/schemas/decks.py
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


from .object_id import PyObjectId


SourceType = Literal["powerpoint", "pdf", "text", "chat", "unknown"]


class DeckCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=80)
    source_type: SourceType = "unknown"
    source_ref: Optional[str] = Field(default=None, max_length=200)
    tags: List[str] = Field(default_factory=list, max_items=20)  # type: ignore


class DeckDocument(BaseModel):
    """
    Internal representation of a Mongo document.
    Useful when reading from Mongo.
    """

    id: PyObjectId = Field(alias="_id")
    uid: str
    title: str
    description: Optional[str] = None
    source_type: SourceType = "unknown"
    source_ref: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {PyObjectId: str},
    }


class DeckCreateResponse(BaseModel):
    deck_id: str
    title: str
    source_type: SourceType
    source_ref: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class DeckListItem(BaseModel):
    deck_id: str
    title: str
    description: Optional[str] = None
    source_type: Optional[str] = None
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    card_count: int
    mastery_score: Optional[float] = 0  # ✅ important


class DeckDetailResponse(BaseModel):
    deck_id: str
    title: str
    description: Optional[str] = None
    source_type: SourceType
    source_ref: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
