import os
import json
from typing import Any, Dict, Iterable, List

from app.services.ollama_client import get_ollama_client

CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "gemma3:latest").strip()


def _sse(data: Dict[str, Any]) -> str:
    # SSE format: "data: <json>\n\n"
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def stream_chat_sse(messages: List[Dict[str, Any]]) -> Iterable[str]:
    """
    Yields SSE events:
      - token events: {"type":"token","token":"..."}
      - done event:   {"type":"done"}
      - error event:  {"type":"error","message":"..."}
    """
    client = get_ollama_client()

    try:
        # ollama-python: stream=True returns an iterator of chunks  [oai_citation:1‡GitHub](https://github.com/ollama/ollama-python?utm_source=chatgpt.com)
        stream = client.chat(
            model=CHAT_MODEL,
            messages=messages,
            stream=True,
        )

        for chunk in stream:
            token = (chunk.get("message", {}) or {}).get("content", "")
            if token:
                yield _sse({"type": "token", "token": token})

        yield _sse({"type": "done"})
    except Exception as e:
        yield _sse({"type": "error", "message": str(e)})
