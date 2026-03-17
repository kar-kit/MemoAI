from datetime import datetime, timezone

from tests.conftest import make_payload
from app.schemas.survey import SurveyResponseCreate
import app.routers.survey as survey_router


def test_submit_survey_response_success(authed_client, monkeypatch):
    def fake_create_survey_response(uid, payload):
        now = datetime.now(timezone.utc)
        dumped = payload.model_dump()

        return {
            **dumped,
            "survey_response_id": "resp-1",
            "uid": uid,
            "submitted_at": now,
            "created_at": now,
        }

    monkeypatch.setattr(
        survey_router,
        "create_survey_response",
        fake_create_survey_response,
    )

    payload = make_payload(SurveyResponseCreate)

    res = authed_client.post("/survey/responses", json=payload)

    assert res.status_code == 200
    body = res.json()
    assert body["survey_response_id"] == "resp-1"
    assert body["uid"] == "user-123"
    assert "submitted_at" in body
    assert "created_at" in body
