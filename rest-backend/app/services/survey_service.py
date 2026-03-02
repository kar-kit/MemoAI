# app/services/survey_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from bson import ObjectId

from app.db.client import db
from app.schemas.survey import SurveyResponseCreate


def create_survey_response(
    *, uid: str, payload: SurveyResponseCreate
) -> Dict[str, Any]:
    now = datetime.utcnow()

    doc = {
        "uid": uid,
        # use client timestamp if provided, otherwise server timestamp
        "submitted_at": payload.submitted_at or now,
        "created_at": now,
        "answers": payload.answers,
    }

    res = db.survey_responses.insert_one(doc)

    return {
        "survey_response_id": str(res.inserted_id),
        "uid": uid,
        "submitted_at": doc["submitted_at"],
        "created_at": doc["created_at"],
        "answers": doc["answers"],
    }
