from fastapi import APIRouter, HTTPException, status
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
        name=user["name"],
        email=user["email"],
    )


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(payload: LoginRequest):
    user = authenticate_user(db, payload.email, payload.password)

    # Avoid leaking whether email exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return LoginResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
    )
