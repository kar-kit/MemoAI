import os
from typing import Any, Dict, List, Optional

from .ollama_client import get_ollama_client

# Env defaults (override in .env)
CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "gemma3:latest").strip()
TOOL_MODEL = os.getenv("OLLAMA_TOOL_MODEL", "functiongemma:latest").strip()


def chat(messages: List[Dict[str, Any]], *, model: Optional[str] = None) -> str:
    """
    General chat with the larger model.
    Returns the assistant text content.

    messages example:
      [{"role":"user","content":"Hello"}]
    """
    client = get_ollama_client()
    use_model = (model or CHAT_MODEL).strip()

    resp = client.chat(
        model=use_model,
        messages=messages,
    )

    # ollama-python returns a dict like:
    # {"message": {"role":"assistant","content":"..."}, ...}
    return resp["message"]["content"]


def tool_call(
    messages: List[Dict[str, Any]],
    *,
    tools: List[Dict[str, Any]],
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Tool/function-calling pass with the smaller model.
    Returns the full response dict so you can inspect tool calls.

    tools example shape (OpenAI-style):
      [{"type":"function","function":{"name":"create_deck","description":"...","parameters":{...}}}]
    """
    client = get_ollama_client()
    use_model = (model or TOOL_MODEL).strip()

    resp = client.chat(
        model=use_model,
        messages=messages,
        tools=tools,
    )

    return resp  # type: ignore
