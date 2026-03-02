# app/routers/survey.py
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies.auth import require_session
from app.schemas.survey import SurveyResponseCreate, SurveyResponseOut
from app.services.survey_service import create_survey_response

router = APIRouter(
    prefix="/survey",
    tags=["survey"],
    dependencies=[Depends(require_session)],
)


@router.post("/responses", response_model=SurveyResponseOut)
def submit_survey_response(
    payload: SurveyResponseCreate,
    uid: str = Depends(require_session),
):
    return create_survey_response(uid=uid, payload=payload)
