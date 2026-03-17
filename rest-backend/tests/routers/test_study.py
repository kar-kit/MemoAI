from datetime import datetime, timezone

import app.routers.study as study_router


def test_study_next_success(authed_client, monkeypatch):
    monkeypatch.setattr(
        study_router,
        "get_next_card",
        lambda uid, deck_id, limit: (
            {
                "card_id": "c1",
                "deck_id": deck_id,
                "front": "Q1",
                "back": "A1",
                "last_rating": 4,
            },
            3,
        ),
    )

    res = authed_client.get("/decks/deck-1/study/next")

    assert res.status_code == 200
    body = res.json()
    assert body["deck_id"] == "deck-1"
    assert body["card"]["card_id"] == "c1"
    assert body["remaining"] == 3


def test_study_rate_success(authed_client, monkeypatch):
    rated_at = datetime.now(timezone.utc)

    monkeypatch.setattr(
        study_router,
        "rate_card",
        lambda uid, deck_id, card_id, rating: {
            "rating": rating,
            "rated_at": rated_at,
        },
    )

    res = authed_client.post(
        "/decks/deck-1/study/card-1/rate",
        json={"rating": 5},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["deck_id"] == "deck-1"
    assert body["card_id"] == "card-1"
    assert body["rating"] == 5
    assert body["rated_at"].replace("Z", "+00:00") == rated_at.isoformat()


def test_study_score_success(authed_client, monkeypatch):
    monkeypatch.setattr(study_router, "get_deck_score", lambda uid, deck_id: 87)

    res = authed_client.get("/decks/deck-1/study/score")

    assert res.status_code == 200
    assert res.json() == {"deck_id": "deck-1", "score": 87}
