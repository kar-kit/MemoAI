# app/schemas/chat.py
from pydantic import BaseModel
from typing import Literal


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str
