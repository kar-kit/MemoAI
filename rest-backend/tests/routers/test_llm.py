import json
from datetime import datetime
from types import SimpleNamespace

from bson import ObjectId

import app.routers.llm as llm_router


class FakeIntent:
    def __init__(self, intent: str, confidence: float, args: dict | None = None):
        self.intent = intent
        self.confidence = confidence
        self.args = args or {}

    def model_dump(self):
        return {
            "intent": self.intent,
            "confidence": self.confidence,
            "args": self.args,
        }


class FakeCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, *args, **kwargs):
        return self

    def limit(self, n):
        return FakeCursor(self.items[:n])

    def __iter__(self):
        return iter(self.items)


def _messages_payload(chat_id: str, content: str = "Hello"):
    return {
        "chat_id": chat_id,
        "messages": [{"role": "user", "content": content}],
    }


def test_chat_with_llm_success(authed_client, monkeypatch):
    chat_id = str(ObjectId())

    monkeypatch.setattr(llm_router, "_ensure_chat_owner", lambda uid, chat_id: None)
    monkeypatch.setattr(llm_router, "_save_message", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_maybe_set_title", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_touch_chat", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "chat", lambda messages: "Assistant reply")

    res = authed_client.post("/llm/chat", json=_messages_payload(chat_id))

    assert res.status_code == 200
    assert res.json() == {"response": "Assistant reply"}


def test_chat_stream_success(authed_client, monkeypatch):
    chat_id = str(ObjectId())

    monkeypatch.setattr(llm_router, "_ensure_chat_owner", lambda uid, chat_id: None)
    monkeypatch.setattr(llm_router, "_save_message", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_maybe_set_title", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_touch_chat", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        llm_router,
        "stream_chat_sse",
        lambda messages: [
            'data: {"type":"token","token":"Hi"}\n\n',
            'data: {"type":"token","token":" there"}\n\n',
        ],
    )

    res = authed_client.post("/llm/chat/stream", json=_messages_payload(chat_id))

    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    assert "token" in res.text


def test_chat_with_file_success(authed_client, monkeypatch):
    async def fake_extract_text_from_file(file):
        return "This is extracted study text."

    monkeypatch.setattr(
        llm_router, "extract_text_from_file", fake_extract_text_from_file
    )
    monkeypatch.setattr(llm_router, "chat", lambda messages: "Answer from file")

    res = authed_client.post(
        "/llm/chat/with-file",
        data={"message": "What is this about?"},
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert res.status_code == 200
    assert res.json() == {"response": "Answer from file"}


def test_dispatch_llm_generate_deck_success(authed_client, monkeypatch):
    chat_id = str(ObjectId())

    monkeypatch.setattr(llm_router, "_ensure_chat_owner", lambda uid, chat_id: None)
    monkeypatch.setattr(llm_router, "_save_message", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_maybe_set_title", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_touch_chat", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        llm_router,
        "detect_intent",
        lambda messages, file_present: FakeIntent(
            "generate_deck",
            0.95,
            {"title": "OS Deck", "card_count": 5},
        ),
    )
    monkeypatch.setattr(
        llm_router,
        "generate_deck_from_text_chunked",
        lambda **kwargs: {
            "deck_id": "deck-1",
            "title": "OS Deck",
            "card_count": 5,
            "preview_cards": [{"front": "Q1", "back": "A1"}],
        },
    )

    res = authed_client.post(
        "/llm/dispatch", json=_messages_payload(chat_id, "make me flashcards")
    )

    assert res.status_code == 200
    body = res.json()
    assert body["action"]["type"] == "deck_created"
    assert body["action"]["deck_id"] == "deck-1"


def test_dispatch_with_file_generate_deck_success(authed_client, monkeypatch):
    chat_id = str(ObjectId())

    async def fake_extract_text_from_file(file):
        return "Extracted PDF content"

    monkeypatch.setattr(llm_router, "_ensure_chat_owner", lambda uid, chat_id: None)
    monkeypatch.setattr(llm_router, "_save_message", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_maybe_set_title", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_touch_chat", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        llm_router, "extract_text_from_file", fake_extract_text_from_file
    )
    monkeypatch.setattr(
        llm_router,
        "detect_intent",
        lambda messages, file_present: FakeIntent(
            "generate_deck",
            0.9,
            {"title": "PDF Deck", "card_count": 4},
        ),
    )
    monkeypatch.setattr(
        llm_router,
        "generate_deck_from_text_chunked",
        lambda **kwargs: {
            "deck_id": "deck-2",
            "title": "PDF Deck",
            "card_count": 4,
            "preview_cards": [{"front": "Q1", "back": "A1"}],
        },
    )

    res = authed_client.post(
        "/llm/dispatch/with-file",
        data={"chat_id": chat_id, "message": "make a deck"},
        files={"file": ("slides.pdf", b"pdf-data", "application/pdf")},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["action"]["type"] == "deck_created"
    assert body["action"]["title"] == "PDF Deck"


def test_dispatch_stream_success(authed_client, monkeypatch):
    chat_id = str(ObjectId())

    monkeypatch.setattr(llm_router, "_ensure_chat_owner", lambda uid, chat_id: None)
    monkeypatch.setattr(llm_router, "_save_message", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_maybe_set_title", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_touch_chat", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        llm_router,
        "detect_intent",
        lambda messages, file_present: FakeIntent("chat", 0.4, {}),
    )
    monkeypatch.setattr(
        llm_router,
        "stream_chat_sse",
        lambda messages: ['data: {"type":"token","token":"Hello"}\n\n'],
    )

    res = authed_client.post(
        "/llm/dispatch/stream", json=_messages_payload(chat_id, "hello")
    )

    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    assert "Hello" in res.text


def test_dispatch_stream_with_file_success(authed_client, monkeypatch):
    chat_id = str(ObjectId())

    async def fake_extract_text_from_file(file):
        return "Extracted powerpoint content"

    monkeypatch.setattr(llm_router, "_ensure_chat_owner", lambda uid, chat_id: None)
    monkeypatch.setattr(llm_router, "_save_message", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_maybe_set_title", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_router, "_touch_chat", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        llm_router, "extract_text_from_file", fake_extract_text_from_file
    )
    monkeypatch.setattr(
        llm_router,
        "detect_intent",
        lambda messages, file_present: FakeIntent(
            "generate_deck",
            0.91,
            {"title": "Slides Deck", "card_count": 6},
        ),
    )
    monkeypatch.setattr(
        llm_router,
        "generate_deck_from_text_chunked",
        lambda **kwargs: {
            "deck_id": "deck-3",
            "title": "Slides Deck",
            "card_count": 6,
            "preview_cards": [{"front": "Q1", "back": "A1"}],
        },
    )

    res = authed_client.post(
        "/llm/dispatch/stream/with-file",
        data={"chat_id": chat_id, "message": "make flashcards from this"},
        files={
            "file": (
                "lecture.pptx",
                b"pptx-data",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            )
        },
    )

    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    assert "deck_created" in res.text


def test_create_chat_success(authed_client, monkeypatch):
    inserted_id = ObjectId()

    fake_db = SimpleNamespace(
        chats=SimpleNamespace(
            insert_one=lambda doc: SimpleNamespace(inserted_id=inserted_id)
        )
    )

    monkeypatch.setattr(llm_router, "db", fake_db)

    res = authed_client.post("/llm/chats")

    assert res.status_code == 200
    body = res.json()
    assert body["chat_id"] == str(inserted_id)
    assert body["title"] == "New chat"


def test_list_chats_success(authed_client, monkeypatch):
    chat_id = ObjectId()

    fake_db = SimpleNamespace(
        chats=SimpleNamespace(
            find=lambda query, projection=None: FakeCursor(
                [
                    {
                        "_id": chat_id,
                        "title": "Chat 1",
                        "updated_at": "2025-01-01T00:00:00Z",
                    }
                ]
            )
        )
    )

    monkeypatch.setattr(llm_router, "db", fake_db)

    res = authed_client.get("/llm/chats")

    assert res.status_code == 200
    body = res.json()
    assert body[0]["chat_id"] == str(chat_id)
    assert body[0]["title"] == "Chat 1"


def test_get_chat_success(authed_client, monkeypatch):
    chat_id = ObjectId()

    fake_db = SimpleNamespace(
        chats=SimpleNamespace(
            find_one=lambda query, projection=None: {"title": "My chat"}
        ),
        messages=SimpleNamespace(
            find=lambda query, projection=None: FakeCursor(
                [
                    {
                        "role": "user",
                        "content": "Hi",
                    },
                    {
                        "role": "assistant",
                        "content": "Hello",
                        "action": {"type": "none"},
                        "attachment": None,
                    },
                ]
            )
        ),
    )

    monkeypatch.setattr(llm_router, "db", fake_db)
    monkeypatch.setattr(llm_router, "_ensure_chat_owner", lambda uid, chat_id: None)

    res = authed_client.get(f"/llm/chats/{chat_id}")

    assert res.status_code == 200
    body = res.json()
    assert body["chat_id"] == str(chat_id)
    assert body["title"] == "My chat"
    assert body["messages"][0]["action"] is None
    assert body["messages"][0]["attachment"] is None
    assert body["messages"][1]["content"] == "Hello"
