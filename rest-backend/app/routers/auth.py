# app/routers/auth.py
from fastapi import APIRouter, HTTPException, status, Request
from app.db.client import db
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
)
from app.services.auth_service import create_user, authenticate_user


"""
This Router Contains
- Register
- Login
"""

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED
)
def register(payload: RegisterRequest):
    try:
        user = create_user(db, payload.name, payload.email, payload.password)
    except ValueError as e:
        if str(e) == "EMAIL_IN_USE":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered",
            )
        raise

    return RegisterResponse(
        id=str(user["_id"]),
        uid=user["uid"],  # ✅ NEW
        name=user["name"],
        email=user["email"],
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request):
    user = authenticate_user(db, payload.email, payload.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # ✅ Store minimal session data
    request.session["uid"] = user["uid"]
    request.session["user_id"] = str(user["_id"])

    return LoginResponse(
        id=str(user["_id"]),
        uid=user["uid"],
        name=user["name"],
        email=user["email"],
    )


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me", response_model=LoginResponse)
def get_current_user(request: Request):
    uid = request.session.get("uid")
    user_id = request.session.get("user_id")

    if not uid or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user = db.users.find_one({"uid": uid})

    if not user:
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )

    return LoginResponse(
        id=str(user["_id"]),
        uid=user["uid"],
        name=user["name"],
        email=user["email"],
    )
