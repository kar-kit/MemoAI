# app/services/sse.py
import json
from fastapi.encoders import jsonable_encoder


def sse_event(payload) -> str:
    safe = jsonable_encoder(payload)  # converts datetime/ObjectId/etc
    return f"data: {json.dumps(safe, ensure_ascii=False)}\n\n"
