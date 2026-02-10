# app/schemas/deck_llm.py
from pydantic import BaseModel, Field
from typing import List


class LLMCard(BaseModel):
    front: str = Field(min_length=1, max_length=300)
    back: str = Field(min_length=1, max_length=1200)


class LLMDeck(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    cards: List[LLMCard] = Field(default_factory=list, max_length=80)
