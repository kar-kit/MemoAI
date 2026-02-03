# app/routers/llm.py
from pydantic import BaseModel
from typing import List, Literal
from fastapi.responses import StreamingResponse

from app.dependencies.auth import require_session
from app.services.llm_service import chat
from app.services.llm_stream_service import stream_chat_sse

from fastapi import APIRouter, UploadFile, File, Form, HTTPException


from app.services.file_parser import extract_text_from_file
from fastapi import APIRouter, Depends

from datetime import datetime
from fastapi import Depends, Request
from bson import ObjectId
from app.db.client import db


router = APIRouter(
    prefix="/llm",
    tags=["llm"],
    dependencies=[Depends(require_session)],  # 🔒 PROTECTS ALL ROUTES
)


# ----- Schemas -----


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    chat_id: str
    messages: List[Message]


class ChatResponse(BaseModel):
    response: str


# ----- Route -----


@router.post("/chat", response_model=ChatResponse)
def chat_with_llm(
    payload: ChatRequest,
    uid: str = Depends(require_session),
):
    chat_id = ObjectId(payload.chat_id)

    # 1. Save user message
    user_message = payload.messages[-1]
    db.messages.insert_one(
        {
            "chat_id": chat_id,
            "role": "user",
            "content": user_message.content,
            "created_at": datetime.utcnow(),
        }
    )

    # 2. Call LLM
    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    assistant_reply = chat(messages)

    # 3. Save assistant reply
    db.messages.insert_one(
        {
            "chat_id": chat_id,
            "role": "assistant",
            "content": assistant_reply,
            "created_at": datetime.utcnow(),
        }
    )

    # 👉 STEP 6 GOES HERE
    chat_doc = db.chats.find_one({"_id": chat_id, "uid": uid})

    if chat_doc and chat_doc["title"] == "New chat":
        title_prompt = (
            "Give a short title (max 3 words) for this conversation.\n\n"
            f"User message:\n{user_message.content}"
        )

        title = chat([{"role": "user", "content": title_prompt}])

        db.chats.update_one({"_id": chat_id}, {"$set": {"title": title.strip()}})

    # 4. Touch chat timestamp
    db.chats.update_one(
        {"_id": chat_id, "uid": uid}, {"$set": {"updated_at": datetime.utcnow()}}
    )

    return {"response": assistant_reply}


@router.post("/chat/stream")
def chat_stream(
    payload: ChatRequest,
    uid: str = Depends(require_session),
):
    """
    Streams assistant tokens over SSE AND persists both user + assistant messages.
    """
    try:
        chat_id = ObjectId(payload.chat_id)

        # Ensure chat belongs to user
        chat_doc = db.chats.find_one({"_id": chat_id, "uid": uid})
        if not chat_doc:
            raise HTTPException(status_code=404, detail="Chat not found")

        # 1) Save latest user message
        user_message = payload.messages[-1]
        db.messages.insert_one(
            {
                "chat_id": chat_id,
                "role": "user",
                "content": user_message.content,
                "created_at": datetime.utcnow(),
            }
        )

        # 2) Stream from LLM, but also capture final assistant text
        messages = [{"role": m.role, "content": m.content} for m in payload.messages]
        generator = stream_chat_sse(messages)

        def sse_wrapper():
            assistant_text = ""

            try:
                for chunk in generator:
                    # stream_chat_sse is emitting "data: {json}\n\n"
                    # we also want to parse token chunks to store final assistant response
                    if chunk.startswith("data: "):
                        raw = chunk.replace("data: ", "").strip()
                        # raw might be json; if it fails, just ignore
                        try:
                            import json

                            evt = json.loads(raw)
                            if evt.get("type") == "token":
                                assistant_text += evt.get("token", "")
                        except Exception:
                            pass

                    yield chunk

            finally:
                # 3) Save assistant reply at end (if any)
                if assistant_text.strip():
                    db.messages.insert_one(
                        {
                            "chat_id": chat_id,
                            "role": "assistant",
                            "content": assistant_text,
                            "created_at": datetime.utcnow(),
                        }
                    )

                # 4) Title generation (same logic you had in /chat)
                chat_doc2 = db.chats.find_one({"_id": chat_id, "uid": uid})
                if chat_doc2 and chat_doc2.get("title") == "New chat":
                    title_prompt = (
                        "Give a short title (max 5 words). No quotes. No punctuation.\n\n"
                        f"User message:\n{user_message.content}"
                    )
                    title = chat([{"role": "user", "content": title_prompt}]).strip()
                    title = title.replace("\n", " ").replace('"', "").strip()[:40]
                    if title:
                        db.chats.update_one(
                            {"_id": chat_id}, {"$set": {"title": title}}
                        )

                # 5) Touch chat timestamp
                db.chats.update_one(
                    {"_id": chat_id, "uid": uid},
                    {"$set": {"updated_at": datetime.utcnow()}},
                )

        return StreamingResponse(
            sse_wrapper(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/with-file", response_model=ChatResponse)
async def chat_with_file(
    message: str = Form(...),
    file: UploadFile = File(...),
):
    try:
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

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chats")
def create_chat(uid: str = Depends(require_session)):
    now = datetime.utcnow()

    doc = {
        "uid": uid,
        "title": "New chat",
        "created_at": now,
        "updated_at": now,
    }

    result = db.chats.insert_one(doc)

    return {
        "chat_id": str(result.inserted_id),
        "title": doc["title"],
        "updated_at": doc["updated_at"],
    }


@router.get("/chats")
def list_chats(uid: str = Depends(require_session)):
    chats = list(
        db.chats.find({"uid": uid}, {"title": 1, "updated_at": 1}).sort(
            "updated_at", -1
        )
    )

    return [
        {
            "chat_id": str(c["_id"]),
            "title": c["title"],
            "updated_at": c["updated_at"],
        }
        for c in chats
    ]


@router.get("/chats/{chat_id}")
def get_chat(chat_id: str, uid: str = Depends(require_session)):
    chat = db.chats.find_one({"_id": ObjectId(chat_id), "uid": uid})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = list(
        db.messages.find(
            {"chat_id": ObjectId(chat_id)}, {"_id": 0, "role": 1, "content": 1}
        ).sort("created_at", 1)
    )

    return {
        "chat_id": chat_id,
        "title": chat["title"],
        "messages": messages,
    }
