from datetime import datetime, timezone
from types import SimpleNamespace

from bson import ObjectId

from app.schemas.cards import CardCreate
from app.schemas.decks import DeckCreateRequest
import app.routers.decks as decks_router


class FakeCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, *args, **kwargs):
        return self

    def limit(self, n):
        return FakeCursor(self.items[:n])

    def __iter__(self):
        return iter(self.items)


def test_create_deck_route_success(authed_client, monkeypatch):
    fake_result = SimpleNamespace(
        deck_id="deck-1",
        title="OS Week 4",
        source_type="text",
        source_ref=None,
        tags=[],
        created_at="2025-01-01T00:00:00Z",
        updated_at="2025-01-01T00:00:00Z",
    )

    monkeypatch.setattr(decks_router, "create_deck", lambda **kwargs: fake_result)

    payload = DeckCreateRequest(
        title=" OS Week 4 ",
        source_type="text",
        source_ref=None,
        tags=[],
    ).model_dump()

    res = authed_client.post("/decks", json=payload)

    assert res.status_code == 200
    assert res.json()["deck_id"] == "deck-1"
    assert res.json()["title"] == "OS Week 4"


def test_list_decks_route_adds_mastery_scores(authed_client, monkeypatch):
    monkeypatch.setattr(
        decks_router,
        "list_decks",
        lambda uid, limit: [
            {"deck_id": "d1", "title": "Deck 1"},
            {"deck_id": "d2", "title": "Deck 2"},
        ],
    )
    monkeypatch.setattr(
        decks_router,
        "get_deck_scores_bulk",
        lambda uid, deck_ids: {"d1": 82, "d2": 45},
    )

    res = authed_client.get("/decks")

    assert res.status_code == 200
    body = res.json()
    assert body[0]["mastery_score"] == 82
    assert body[1]["mastery_score"] == 45


def test_get_deck_route_success(authed_client, monkeypatch):
    deck_oid = ObjectId()
    card_oid = ObjectId()

    fake_db = SimpleNamespace(
        decks=SimpleNamespace(
            find_one=lambda query, projection=None: {
                "_id": deck_oid,
                "title": "Networks",
                "description": None,
                "source_type": "text",
                "source_ref": None,
                "tags": [],
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-01T00:00:00Z",
            }
        ),
        cards=SimpleNamespace(
            find=lambda query, projection=None: FakeCursor(
                [
                    {
                        "_id": card_oid,
                        "deck_id": deck_oid,
                        "front": "Q1",
                        "back": "A1",
                    }
                ]
            )
        ),
    )

    monkeypatch.setattr(decks_router, "db", fake_db)

    res = authed_client.get(f"/decks/{deck_oid}")

    assert res.status_code == 200
    body = res.json()
    assert body["deck"]["deck_id"] == str(deck_oid)
    assert body["cards"][0]["card_id"] == str(card_oid)
    assert body["cards"][0]["front"] == "Q1"


def test_get_deck_preview_route_success(authed_client, monkeypatch):
    monkeypatch.setattr(
        decks_router,
        "get_deck_with_preview",
        lambda uid, deck_id, preview_count: {
            "deck_id": deck_id,
            "title": "Preview Deck",
            "preview_cards": [{"front": "Q1", "back": "A1"}],
        },
    )

    res = authed_client.get(f"/decks/{ObjectId()}/preview?preview_count=2")

    assert res.status_code == 200
    assert res.json()["title"] == "Preview Deck"


def test_add_cards_route_success(authed_client, monkeypatch):
    deck_id = str(ObjectId())

    monkeypatch.setattr(
        decks_router, "bulk_insert_cards", lambda uid, deck_id, cards: 2
    )
    monkeypatch.setattr(
        decks_router,
        "get_deck_with_preview",
        lambda uid, deck_id, preview_count: {
            "deck_id": deck_id,
            "title": "Deck",
            "preview_cards": [{"front": "Q1", "back": "A1"}],
        },
    )

    payload = [
        CardCreate(front="Q1", back="A1").model_dump(),
        CardCreate(front="Q2", back="A2").model_dump(),
    ]

    res = authed_client.post(f"/decks/{deck_id}/cards", json=payload)

    assert res.status_code == 200
    assert res.json()["inserted"] == 2
    assert res.json()["deck"]["deck_id"] == deck_id


def test_list_cards_route_success(authed_client, monkeypatch):
    deck_id = str(ObjectId())

    monkeypatch.setattr(
        decks_router,
        "get_deck_cards",
        lambda uid, deck_id, limit, skip: [
            {
                "card_id": str(ObjectId()),
                "deck_id": deck_id,
                "front": "What is BFS?",
                "back": "Breadth-first search",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ],
    )

    res = authed_client.get(f"/decks/{deck_id}/cards")

    assert res.status_code == 200
    body = res.json()
    assert body["deck_id"] == deck_id
    assert len(body["cards"]) == 1


def test_update_card_success(authed_client, monkeypatch):
    deck_id = ObjectId()
    card_id = ObjectId()

    fake_db = SimpleNamespace(
        decks=SimpleNamespace(find_one=lambda query, projection=None: {"_id": deck_id}),
        cards=SimpleNamespace(
            update_one=lambda query, update: SimpleNamespace(matched_count=1)
        ),
    )

    monkeypatch.setattr(decks_router, "db", fake_db)

    res = authed_client.patch(
        f"/decks/{deck_id}/cards/{card_id}",
        json={"front": "Updated front", "back": "Updated back"},
    )

    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_delete_card_not_found_returns_404(authed_client, monkeypatch):
    deck_id = ObjectId()
    card_id = ObjectId()

    fake_db = SimpleNamespace(
        decks=SimpleNamespace(find_one=lambda query, projection=None: {"_id": deck_id}),
        cards=SimpleNamespace(
            delete_one=lambda query: SimpleNamespace(deleted_count=0)
        ),
    )

    monkeypatch.setattr(decks_router, "db", fake_db)

    res = authed_client.delete(f"/decks/{deck_id}/cards/{card_id}")

    assert res.status_code == 404
    assert res.json()["detail"] == "Card not found"


def test_invalid_object_id_returns_400(authed_client):
    res = authed_client.get("/decks/not-a-valid-object-id")

    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid ObjectId"
