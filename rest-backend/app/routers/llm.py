# app/routers/llm.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.db.client import db
from app.dependencies.auth import require_session
from app.schemas.chat import Message
from app.schemas.llm_dispatch import DispatchRequest, DispatchResponse
from app.services.deck_generation_service import generate_deck_from_text_chunked
from app.services.file_parser import extract_text_from_file
from app.services.intent_service import detect_intent
from app.services.llm_service import chat
from app.services.llm_stream_service import stream_chat_sse
from app.services.sse import sse_event

import logging

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/llm", tags=["llm"], dependencies=[Depends(require_session)])


# ----- Schemas (chat endpoints) -----


class ChatRequest(BaseModel):
    chat_id: str
    messages: List[Message]


class ChatResponse(BaseModel):
    response: str


# ----- Helpers -----


def _oid(id_str: str) -> ObjectId:
    if not ObjectId.is_valid(id_str):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")
    return ObjectId(id_str)


def _ensure_chat_owner(uid: str, chat_id: ObjectId):
    chat_doc = db.chats.find_one({"_id": chat_id, "uid": uid}, {"_id": 1})
    if not chat_doc:
        raise HTTPException(status_code=404, detail="Chat not found")


def _save_message(
    chat_id: ObjectId,
    role: str,
    content: str,
    action: Optional[Dict[str, Any]] = None,
    attachment: Optional[Dict[str, Any]] = None,
):
    doc: Dict[str, Any] = {
        "chat_id": chat_id,
        "role": role,
        "content": content,
        "created_at": datetime.utcnow(),
    }
    if action is not None:
        doc["action"] = action
    if attachment is not None:
        doc["attachment"] = attachment

    db.messages.insert_one(doc)


def _touch_chat(uid: str, chat_id: ObjectId):
    db.chats.update_one(
        {"_id": chat_id, "uid": uid}, {"$set": {"updated_at": datetime.utcnow()}}
    )


def _maybe_set_title(uid: str, chat_id: ObjectId, user_text: str):
    chat_doc = db.chats.find_one({"_id": chat_id, "uid": uid}, {"title": 1})
    if chat_doc and chat_doc.get("title") == "New chat":
        title_prompt = (
            "Give a short title (max 5 words). No quotes. No punctuation.\n\n"
            f"User message:\n{user_text}"
        )
        title = chat([{"role": "user", "content": title_prompt}]).strip()
        title = title.replace("\n", " ").replace('"', "").strip()[:40]
        if title:
            db.chats.update_one({"_id": chat_id}, {"$set": {"title": title}})


# ----- Routes -----


@router.post("/chat", response_model=ChatResponse)
def chat_with_llm(payload: ChatRequest, uid: str = Depends(require_session)):
    chat_id = _oid(payload.chat_id)
    _ensure_chat_owner(uid, chat_id)

    user_message = payload.messages[-1]
    _save_message(chat_id, "user", user_message.content)

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    assistant_reply = chat(messages)

    _save_message(chat_id, "assistant", assistant_reply)
    _maybe_set_title(uid, chat_id, user_message.content)
    _touch_chat(uid, chat_id)

    return {"response": assistant_reply}


@router.post("/chat/stream")
def chat_stream(payload: ChatRequest, uid: str = Depends(require_session)):
    chat_id = _oid(payload.chat_id)
    _ensure_chat_owner(uid, chat_id)

    user_message = payload.messages[-1]
    _save_message(chat_id, "user", user_message.content)

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    generator = stream_chat_sse(messages)

    def sse_wrapper():
        assistant_text = ""

        try:
            for chunk in generator:
                yield chunk
                if chunk.startswith("data: "):
                    raw = chunk.replace("data: ", "").strip()
                    try:
                        import json

                        evt = json.loads(raw)
                        if evt.get("type") == "token":
                            assistant_text += evt.get("token", "")
                    except Exception:
                        pass
        finally:
            if assistant_text.strip():
                _save_message(chat_id, "assistant", assistant_text)
            _maybe_set_title(uid, chat_id, user_message.content)
            _touch_chat(uid, chat_id)

    return StreamingResponse(
        sse_wrapper(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/chat/with-file", response_model=ChatResponse)
async def chat_with_file(
    message: str = Form(...),
    file: UploadFile = File(...),
    uid: str = Depends(require_session),
):
    extracted = await extract_text_from_file(file)

    prompt = (
        "You are given study material below.\n"
        "Use ONLY this material to answer the user. "
        "If the answer isn't in the material, say you can't find it.\n\n"
        "--- MATERIAL START ---\n"
        f"{extracted}\n"
        "--- MATERIAL END ---\n\n"
        "User question:\n"
        f"{message}\n"
    )

    answer = chat([{"role": "user", "content": prompt}])
    return {"response": answer}


@router.post("/dispatch", response_model=DispatchResponse)
def dispatch_llm(payload: DispatchRequest, uid: str = Depends(require_session)):
    chat_id = _oid(payload.chat_id)
    _ensure_chat_owner(uid, chat_id)

    user_message = payload.messages[-1]
    _save_message(chat_id, "user", user_message.content)

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    intent = detect_intent(messages, file_present=False)

    if intent.intent == "generate_deck" and intent.confidence >= 0.7:
        result = generate_deck_from_text_chunked(
            uid=uid,
            source_text=user_message.content,
            source_type="chat",
            source_ref=str(payload.chat_id),
            requested_title=intent.args.get("title"),
            requested_card_count=intent.args.get("card_count"),
        )

        assistant_reply = (
            f'Done — I made a deck called "{result["title"]}" '
            f'with {result["card_count"]} cards.'
        )

        action = {
            "type": "deck_created",
            "deck_id": result["deck_id"],
            "title": result["title"],
            "card_count": result["card_count"],
            "preview_cards": result["preview_cards"],
        }

        _save_message(chat_id, "assistant", assistant_reply, action=action)
        _maybe_set_title(uid, chat_id, user_message.content)
        _touch_chat(uid, chat_id)

        return {"response": assistant_reply, "action": action}

    assistant_reply = chat(messages)
    _save_message(chat_id, "assistant", assistant_reply)
    _maybe_set_title(uid, chat_id, user_message.content)
    _touch_chat(uid, chat_id)
    return {"response": assistant_reply, "action": None}


@router.post("/dispatch/with-file", response_model=DispatchResponse)
async def dispatch_llm_with_file(
    chat_id: str = Form(...),
    message: str = Form(...),
    file: UploadFile = File(...),
    uid: str = Depends(require_session),
):
    chat_oid = _oid(chat_id)
    _ensure_chat_owner(uid, chat_oid)

    attachment = {"name": file.filename, "mime": file.content_type}
    _save_message(chat_oid, "user", message, attachment=attachment)

    fn = (file.filename or "").lower()
    if fn.endswith(".ppt") or fn.endswith(".pptx"):
        source_type = "powerpoint"
    elif fn.endswith(".pdf"):
        source_type = "pdf"
    else:
        source_type = "unknown"

    extracted = await extract_text_from_file(file)
    intent = detect_intent([{"role": "user", "content": message}], file_present=True)

    if intent.intent == "generate_deck" and intent.confidence >= 0.7:
        result = generate_deck_from_text_chunked(
            uid=uid,
            source_text=extracted,
            source_type=source_type,
            source_ref=file.filename,
            requested_title=intent.args.get("title"),
            requested_card_count=intent.args.get("card_count"),
        )

        assistant_reply = (
            f'Done — I made a deck called "{result["title"]}" '
            f'with {result["card_count"]} cards.'
        )

        action = {
            "type": "deck_created",
            "deck_id": result["deck_id"],
            "title": result["title"],
            "card_count": result["card_count"],
            "preview_cards": result["preview_cards"],
        }

        _save_message(chat_oid, "assistant", assistant_reply, action=action)
        _maybe_set_title(uid, chat_oid, message)
        _touch_chat(uid, chat_oid)

        return {"response": assistant_reply, "action": action}

    prompt = (
        "You are given study material below.\n"
        "Use ONLY this material to answer the user. "
        "If the answer isn't in the material, say you can't find it.\n\n"
        "--- MATERIAL START ---\n"
        f"{extracted}\n"
        "--- MATERIAL END ---\n\n"
        "User question:\n"
        f"{message}\n"
    )

    assistant_reply = chat([{"role": "user", "content": prompt}]).strip()
    _save_message(chat_oid, "assistant", assistant_reply)
    _maybe_set_title(uid, chat_oid, message)
    _touch_chat(uid, chat_oid)

    return {"response": assistant_reply, "action": None}


@router.post("/dispatch/stream")
def dispatch_stream(payload: DispatchRequest, uid: str = Depends(require_session)):
    chat_id = _oid(payload.chat_id)
    _ensure_chat_owner(uid, chat_id)

    user_message = payload.messages[-1]
    _save_message(chat_id, "user", user_message.content)

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    intent = detect_intent(messages, file_present=False)

    def sse_wrapper():
        assistant_text = ""

        if intent.intent == "generate_deck" and intent.confidence >= 0.7:
            yield sse_event(
                {
                    "type": "status",
                    "stage": "reading",
                    "message": "Using your message as study material...",
                }
            )
            yield sse_event(
                {
                    "type": "status",
                    "stage": "generating",
                    "message": "Generating flashcards...",
                }
            )

            result = generate_deck_from_text_chunked(
                uid=uid,
                source_text=user_message.content,
                source_type="chat",
                source_ref=str(payload.chat_id),
                requested_title=intent.args.get("title"),
                requested_card_count=intent.args.get("card_count"),
            )

            assistant_text = (
                f'Done — I made a deck called "{result["title"]}" '
                f'with {result["card_count"]} cards.'
            )

            action = {
                "type": "deck_created",
                "deck_id": result["deck_id"],
                "title": result["title"],
                "card_count": result["card_count"],
                "preview_cards": result["preview_cards"],
            }

            _save_message(chat_id, "assistant", assistant_text, action=action)
            _maybe_set_title(uid, chat_id, user_message.content)
            _touch_chat(uid, chat_id)

            yield sse_event(
                {"type": "done", "response": assistant_text, "action": action}
            )
            return

        generator = stream_chat_sse(messages)
        try:
            for chunk in generator:
                yield chunk
                if chunk.startswith("data: "):
                    raw = chunk.replace("data: ", "").strip()
                    try:
                        import json

                        evt = json.loads(raw)
                        if evt.get("type") == "token":
                            assistant_text += evt.get("token", "")
                    except Exception:
                        pass
        finally:
            if assistant_text.strip():
                _save_message(chat_id, "assistant", assistant_text)
            _maybe_set_title(uid, chat_id, user_message.content)
            _touch_chat(uid, chat_id)

    return StreamingResponse(
        sse_wrapper(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/dispatch/stream/with-file")
async def dispatch_stream_with_file(
    chat_id: str = Form(...),
    message: str = Form(...),
    file: UploadFile = File(...),
    uid: str = Depends(require_session),
):
    chat_oid = _oid(chat_id)
    _ensure_chat_owner(uid, chat_oid)

    attachment = {"name": file.filename, "mime": file.content_type}
    _save_message(chat_oid, "user", message, attachment=attachment)

    fn = (file.filename or "").lower()
    if fn.endswith(".ppt") or fn.endswith(".pptx"):
        source_type = "powerpoint"
    elif fn.endswith(".pdf"):
        source_type = "pdf"
    else:
        source_type = "unknown"

    intent = detect_intent([{"role": "user", "content": message}], file_present=True)
    logger.info(f"[dispatch/stream/with-file] intent={intent.model_dump()}")

    extracted = await extract_text_from_file(file)
    logger.info(f"[dispatch/stream/with-file] extracted_len={len(extracted or '')}")
    logger.info(
        f"[dispatch/stream/with-file] extracted_preview={(extracted or '')[:300]}"
    )

    requested = intent.args.get("card_count")
    try:
        card_count = int(requested) if requested is not None else None
    except Exception:
        card_count = None

    # Only clamp if user actually provided a number.
    # Otherwise let deck_generation_service default (requested_card_count=None => defaults to 24)
    if card_count is not None:
        card_count = max(1, min(card_count, 50))

    logger.info(f"[dispatch/stream/with-file] card_count_final={card_count}")

    def sse_wrapper():
        yield sse_event(
            {"type": "status", "stage": "extracting", "message": "Text extracted."}
        )

        if intent.intent == "generate_deck" and intent.confidence >= 0.7:
            yield sse_event(
                {
                    "type": "status",
                    "stage": "generating",
                    "message": "Generating flashcards...",
                }
            )

            result = generate_deck_from_text_chunked(
                uid=uid,
                source_text=extracted,
                source_type=source_type,
                source_ref=file.filename,
                requested_title=intent.args.get("title"),
                requested_card_count=card_count,
            )

            logger.info(
                f"[dispatch/stream/with-file] deck_created deck_id={result.get('deck_id')} cards={result.get('card_count')}"
            )

            assistant_text = (
                f'Done — I made a deck called "{result["title"]}" '
                f'with {result["card_count"]} cards.'
            )

            action = {
                "type": "deck_created",
                "deck_id": result["deck_id"],
                "title": result["title"],
                "card_count": result["card_count"],
                "preview_cards": result["preview_cards"],
            }

            _save_message(chat_oid, "assistant", assistant_text, action=action)
            _maybe_set_title(uid, chat_oid, message)
            _touch_chat(uid, chat_oid)

            yield sse_event(
                {"type": "done", "response": assistant_text, "action": action}
            )
            return

        prompt = (
            "You are given study material below.\n"
            "Use ONLY this material to answer the user. "
            "If the answer isn't in the material, say you can't find it.\n\n"
            "--- MATERIAL START ---\n"
            f"{extracted}\n"
            "--- MATERIAL END ---\n\n"
            "User question:\n"
            f"{message}\n"
        )
        assistant_text = chat([{"role": "user", "content": prompt}]).strip()
        _save_message(chat_oid, "assistant", assistant_text)
        _maybe_set_title(uid, chat_oid, message)
        _touch_chat(uid, chat_oid)

        yield sse_event({"type": "done", "response": assistant_text, "action": None})

    return StreamingResponse(
        sse_wrapper(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/chats")
def create_chat(uid: str = Depends(require_session)):
    now = datetime.utcnow()

    doc = {"uid": uid, "title": "New chat", "created_at": now, "updated_at": now}
    result = db.chats.insert_one(doc)

    return {
        "chat_id": str(result.inserted_id),
        "title": doc["title"],
        "updated_at": doc["updated_at"],
    }


@router.get("/chats")
def list_chats(
    uid: str = Depends(require_session), limit: int = Query(default=50, ge=1, le=200)
):
    chats = list(
        db.chats.find({"uid": uid}, {"title": 1, "updated_at": 1})
        .sort("updated_at", -1)
        .limit(limit)
    )

    return [
        {
            "chat_id": str(c["_id"]),
            "title": c.get("title", "New chat"),
            "updated_at": c.get("updated_at"),
        }
        for c in chats
    ]


@router.get("/chats/{chat_id}")
def get_chat(chat_id: str, uid: str = Depends(require_session)):
    chat_oid = _oid(chat_id)
    _ensure_chat_owner(uid, chat_oid)

    chat_doc = db.chats.find_one({"_id": chat_oid, "uid": uid}, {"title": 1})
    if not chat_doc:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = list(
        db.messages.find(
            {"chat_id": chat_oid},
            {"_id": 0, "role": 1, "content": 1, "action": 1, "attachment": 1},
        ).sort("created_at", 1)
    )

    for m in messages:
        if "action" not in m:
            m["action"] = None
        if "attachment" not in m:
            m["attachment"] = None

    return {
        "chat_id": chat_id,
        "title": chat_doc.get("title", "New chat"),
        "messages": messages,
    }
