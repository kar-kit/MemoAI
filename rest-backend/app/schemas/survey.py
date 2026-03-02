# app/schemas/survey.py
from __future__ import annotations

from datetime import datetime
from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field, field_validator

Likert = Literal[1, 2, 3, 4, 5]

REQUIRED_QUESTION_IDS = [f"q{i}" for i in range(1, 12)]  # q1..q11


class SurveyResponseCreate(BaseModel):
    submitted_at: Optional[datetime] = None
    answers: Dict[str, Likert] = Field(default_factory=dict)

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, v: Dict[str, Likert]):
        # Ensure all required questions exist
        missing = [qid for qid in REQUIRED_QUESTION_IDS if qid not in v]
        if missing:
            raise ValueError(f"Missing required answers: {', '.join(missing)}")

        # Optional: reject unexpected keys (keeps dataset clean)
        extra = [qid for qid in v.keys() if qid not in REQUIRED_QUESTION_IDS]
        if extra:
            raise ValueError(f"Unexpected question ids: {', '.join(extra)}")

        return v


class SurveyResponseOut(BaseModel):
    survey_response_id: str
    uid: str
    submitted_at: datetime
    created_at: datetime
    answers: Dict[str, Likert]
