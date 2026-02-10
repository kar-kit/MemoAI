# app/dependencies/auth.py
from __future__ import annotations

import base64
import json
import logging
from urllib.parse import unquote

from fastapi import HTTPException, Request, status

logger = logging.getLogger("uvicorn.error")


def _decode_session_cookie(session_value: str) -> dict:
    """
    Your cookie looks like:
      <base64(json)>.signature
    Example decoded json:
      {"uid": "...", "user_id": "..."}
    """
    # URL decode first (%3D etc.)
    session_value = unquote(session_value)

    # Remove signature if present (everything after first dot)
    payload_part = session_value.split(".", 1)[0]

    # Base64 decode (add padding if missing)
    padding = "=" * (-len(payload_part) % 4)
    payload_part += padding

    try:
        decoded = base64.b64decode(payload_part).decode("utf-8")
        data = json.loads(decoded)
        if not isinstance(data, dict):
            raise ValueError("Session payload is not an object")
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid session cookie: {e}",
        )


def require_session(request: Request) -> str:
    # ---- debug logs ----
    raw_cookie = request.headers.get("cookie")
    logger.info(f"[require_session] Cookie header: {raw_cookie}")
    logger.info(f"[require_session] request.cookies: {dict(request.cookies)}")

    # 1) If you have SessionMiddleware + browser request hits FastAPI directly:
    uid = None
    try:
        uid = request.session.get("uid")  # type: ignore[attr-defined]
    except Exception:
        uid = None

    if uid:
        return uid

    # 2) Server-to-server (Next SSR fetch) or no SessionMiddleware path:
    session_cookie = request.cookies.get("session")
    logger.info(f"[require_session] request.cookies['session']={session_cookie}")

    if not session_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing session cookie",
        )

    data = _decode_session_cookie(session_cookie)
    uid = data.get("uid")

    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated (uid missing)",
        )

    return uid
