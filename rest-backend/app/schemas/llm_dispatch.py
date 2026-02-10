# app/schemas/llm_dispatch.py
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any

from app.schemas.chat import Message


Intent = Literal["chat", "generate_deck"]


class DispatchRequest(BaseModel):
    chat_id: str
    messages: List[Message]


class IntentResult(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    args: Dict[str, Any] = Field(default_factory=dict)


class DeckCreatedAction(BaseModel):
    type: Literal["deck_created"] = "deck_created"
    deck_id: str
    title: str
    card_count: int
    preview_cards: List[Dict[str, Any]] = Field(default_factory=list)


class DispatchResponse(BaseModel):
    response: str
    action: Optional[DeckCreatedAction] = None
