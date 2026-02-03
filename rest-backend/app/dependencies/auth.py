# app/dependencies/auth.py
from fastapi import Request, HTTPException, status


def require_session(request: Request):
    uid = request.session.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return uid
